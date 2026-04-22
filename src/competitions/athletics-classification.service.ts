// src/competitions/athletics-classification.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AthleticsPhaseClassification } from './entities/athletics-phase-classification.entity';
import { AthleticsResult } from './entities/athletics-result.entity';
import { AthleticsSectionEntry } from './entities/athletics-section-entry.entity';
import { AthleticsSection } from './entities/athletics-section.entity';
import { PhaseRegistration } from './entities/phase-registration.entity';
import { Phase } from './entities/phase.entity';
import { ScoreTablesService } from '../score-tables/score-tables.service';
import { PhaseType } from '../common/enums';

const POINTS_BY_RANK: Record<number, number> = {
  1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

const COMBINED_PHASE_TYPES: PhaseType[] = [
  PhaseType.COMBINED_PISTA,
  PhaseType.COMBINED_DISTANCIA,
  PhaseType.COMBINED_ALTURA,
];

@Injectable()
export class AthleticsClassificationService {
  constructor(
    @InjectRepository(AthleticsPhaseClassification)
    private readonly classificationRepo: Repository<AthleticsPhaseClassification>,

    @InjectRepository(AthleticsResult)
    private readonly athleticsResultRepo: Repository<AthleticsResult>,

    @InjectRepository(AthleticsSectionEntry)
    private readonly sectionEntryRepo: Repository<AthleticsSectionEntry>,

    @InjectRepository(AthleticsSection)
    private readonly athleticsSectionRepo: Repository<AthleticsSection>,

    @InjectRepository(PhaseRegistration)
    private readonly phaseRegRepo: Repository<PhaseRegistration>,

    @InjectRepository(Phase)
    private readonly phaseRepo: Repository<Phase>,

    private readonly scoreTablesService: ScoreTablesService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // PUNTO DE ENTRADA PRINCIPAL
  // ─────────────────────────────────────────────────────────────
  async classifyPhase(phaseId: number): Promise<AthleticsPhaseClassification[]> {
    const phase = await this.phaseRepo.findOne({
      where: { phaseId },
      relations: ['eventCategory'],
    });
    if (!phase) throw new NotFoundException(`Phase #${phaseId} no encontrada`);

    // ── Obtener externalEventId desde event_categories ──────────
    // event_id local siempre es NULL porque trabajamos con sismaster,
    // usamos external_event_id como identificador del campeonato.
    const ecRow: {
      external_event_id: number;
      external_sport_id: number;
      local_sport_id: number;
    } | null = await this.phaseRepo.manager
      .query(
        `SELECT ec.external_event_id,
                ec.external_sport_id,
                s.sport_id AS local_sport_id
        FROM event_categories ec
        LEFT JOIN sports s ON s.sismaster_sport_id = ec.external_sport_id
        WHERE ec.event_category_id = ?`,
        [phase.eventCategoryId],
      )
      .then((rows: any[]) => rows[0] ?? null);

    const externalEventId = ecRow?.external_event_id ?? null;
    const externalSportId = ecRow?.external_sport_id ?? null;
    const localSportId    = ecRow?.local_sport_id    ?? 0;


    const phaseRegs = await this.phaseRegRepo.find({
      where: { phaseId },
      relations: [
        'registration',
        'registration.athlete',
        'registration.athlete.institution',
        'registration.team',
        'registration.team.institution',
      ],
    });
    if (!phaseRegs.length) return [];

    const prIds = phaseRegs.map((pr) => pr.phaseRegistrationId);

    // 1. Marca final de cada atleta según tipo de fase
    const marks = await this.resolveMarks(phase, prIds);

    // 2. Ordenar y asignar rank_position
    const ranked = this.rankMarks(marks, phase.type);

    // 3. Regla 3.5.7: mínimo 2 universidades para puntuar
    const institutionIds = new Set<number>();
    for (const pr of phaseRegs) {
      const reg = (pr as any).registration;
      const inst = reg?.athlete?.institution ?? reg?.team?.institution;
      if (inst?.institutionId) institutionIds.add(inst.institutionId);
    }
    const isScoringEligible = institutionIds.size > 1;

    // 4. Calcular puntos y guardar clasificaciones
    const isCombinedOrRelay = COMBINED_PHASE_TYPES.includes(phase.type) || phase.isRelay;
    const saved: AthleticsPhaseClassification[] = [];

    for (const row of ranked) {
      const basePoints = POINTS_BY_RANK[row.rankPosition] ?? 0;
      const pointsAwarded =
        isCombinedOrRelay && isScoringEligible ? basePoints * 2
        : isScoringEligible ? basePoints
        : 0;

      const existing = await this.classificationRepo.findOne({
        where: { phaseRegistrationId: row.phaseRegistrationId },
      });

      const entity = existing ?? this.classificationRepo.create({
        phaseId,
        phaseRegistrationId: row.phaseRegistrationId,
      });

      entity.rankPosition      = row.rankPosition <= 8 ? row.rankPosition : null;
      entity.pointsAwarded     = pointsAwarded;
      entity.isScoringEligible = isScoringEligible;
      entity.exclusionReason   = isScoringEligible
        ? null
        : 'Solo una universidad participante (regla 3.5.7)';
      entity.finalTime         = row.finalTime ?? null;
      entity.finalDistance     = row.finalDistance ?? null;
      entity.finalHeight       = row.finalHeight ?? null;
      entity.finalIaafPoints   = row.finalIaafPoints ?? null;
      entity.resultSource      = row.resultSource;

      saved.push(await this.classificationRepo.save(entity));
    }

    // 5. Sincronizar score_table solo si tenemos externalEventId
    if (externalEventId && externalSportId) {
      await this.syncScoreTable(
        phaseId, phase, phaseRegs, saved,
        externalEventId, externalSportId, localSportId,
      );
    }

    return saved;
  }

  // ─────────────────────────────────────────────────────────────
  // Resolver marca final según tipo de fase
  // ─────────────────────────────────────────────────────────────
  private async resolveMarks(
    phase: Phase,
    prIds: number[],
  ): Promise<Array<{
    phaseRegistrationId: number;
    finalTime?: string;
    finalDistance?: number;
    finalHeight?: number;
    finalIaafPoints?: number;
    resultSource: AthleticsPhaseClassification['resultSource'];
  }>> {
    switch (phase.type) {
      case PhaseType.COMBINED_DISTANCIA:
        return this.resolveDistanceMarks(prIds);

      case PhaseType.COMBINED_ALTURA:
        return this.resolveHeightMarks(prIds);

      case PhaseType.GRUPO:
      case PhaseType.ELIMINACION:
      case PhaseType.COMBINED_PISTA:
      default:
        // Carreras, postas, vallas, marcha → tiempos en sección entries
        return this.resolveTrackMarks(phase.phaseId, prIds);
    }
  }

  // Carreras: prioriza sección "Finales", fallback a mejor serie
  private async resolveTrackMarks(phaseId: number, prIds: number[]) {
    const sections = await this.athleticsSectionRepo.find({ where: { phaseId } });

    const finalSection = sections.find(
      (s) => s.name.toLowerCase().includes('final'),
    );

    const allEntries = await this.sectionEntryRepo
      .createQueryBuilder('se')
      .where('se.phaseRegistrationId IN (:...prIds)', { prIds })
      .andWhere('se.time IS NOT NULL')
      .getMany();

    const finalsEntries = finalSection
      ? allEntries.filter((e) => e.athleticsSectionId === finalSection.athleticsSectionId)
      : [];

    const result = new Map<number, {
      finalTime: string;
      resultSource: AthleticsPhaseClassification['resultSource'];
    }>();

    for (const e of finalsEntries) {
      if (e.time) {
        result.set(e.phaseRegistrationId, { finalTime: e.time, resultSource: 'finales' });
      }
    }

    for (const e of allEntries) {
      if (!result.has(e.phaseRegistrationId) && e.time) {
        const current = result.get(e.phaseRegistrationId);
        if (!current || this.compareTime(e.time, current.finalTime) < 0) {
          result.set(e.phaseRegistrationId, { finalTime: e.time, resultSource: 'mejor_serie' });
        }
      }
    }

    return prIds
      .filter((id) => result.has(id))
      .map((id) => ({
        phaseRegistrationId: id,
        finalTime: result.get(id)!.finalTime,
        resultSource: result.get(id)!.resultSource,
      }));
  }

  // Saltos/lanzamientos: mejor intento válido
  private async resolveDistanceMarks(prIds: number[]) {
    const attempts = await this.athleticsResultRepo
      .createQueryBuilder('ar')
      .where('ar.phaseRegistrationId IN (:...prIds)', { prIds })
      .andWhere('ar.distance_value IS NOT NULL')
      .andWhere('ar.is_valid = 1')
      .getMany();

    const best = new Map<number, number>();
    for (const a of attempts) {
      const val = Number(a.distanceValue);
      if (!best.has(a.phaseRegistrationId) || val > best.get(a.phaseRegistrationId)!) {
        best.set(a.phaseRegistrationId, val);
      }
    }

    return Array.from(best.entries()).map(([phaseRegistrationId, finalDistance]) => ({
      phaseRegistrationId,
      finalDistance,
      resultSource: 'mejor_intento' as const,
    }));
  }

  // Salto alto/garrocha: mejor altura superada ('O')
  private async resolveHeightMarks(prIds: number[]) {
    const attempts = await this.athleticsResultRepo
      .createQueryBuilder('ar')
      .where('ar.phaseRegistrationId IN (:...prIds)', { prIds })
      .andWhere('ar.height IS NOT NULL')
      .andWhere('ar.height_result = :o', { o: 'O' })
      .getMany();

    const best = new Map<number, number>();
    for (const a of attempts) {
      const val = Number(a.height);
      if (!best.has(a.phaseRegistrationId) || val > best.get(a.phaseRegistrationId)!) {
        best.set(a.phaseRegistrationId, val);
      }
    }

    return Array.from(best.entries()).map(([phaseRegistrationId, finalHeight]) => ({
      phaseRegistrationId,
      finalHeight,
      resultSource: 'mejor_intento' as const,
    }));
  }

  // Heptatlón/Decatlón: suma de iaaf_points (reservado para futuro)
  private async resolveCombinedEventMarks(prIds: number[]) {
    const rows: Array<{ phaseRegistrationId: number; total: string }> =
      await this.athleticsResultRepo
        .createQueryBuilder('ar')
        .select('ar.phaseRegistrationId', 'phaseRegistrationId')
        .addSelect('SUM(ar.iaaf_points)', 'total')
        .where('ar.phaseRegistrationId IN (:...prIds)', { prIds })
        .andWhere('ar.iaaf_points IS NOT NULL')
        .groupBy('ar.phaseRegistrationId')
        .getRawMany();

    return rows.map((r) => ({
      phaseRegistrationId: Number(r.phaseRegistrationId),
      finalIaafPoints: Number(r.total),
      resultSource: 'iaaf_points' as const,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Ordenar marcas y asignar rank_position con manejo de empates
  // ─────────────────────────────────────────────────────────────
  private rankMarks(
    marks: Array<any>,
    phaseType: PhaseType,
  ): Array<any & { rankPosition: number }> {
    const sorted = [...marks].sort((a, b) => {
      if (a.finalTime && b.finalTime) return this.compareTime(a.finalTime, b.finalTime);
      if (a.finalIaafPoints != null && b.finalIaafPoints != null) return b.finalIaafPoints - a.finalIaafPoints;
      const valA = a.finalDistance ?? a.finalHeight ?? 0;
      const valB = b.finalDistance ?? b.finalHeight ?? 0;
      return valB - valA;
    });

    let rank = 1;
    return sorted.map((row, i) => {
      if (i > 0) {
        const prev = sorted[i - 1];
        const tied =
          (row.finalTime && prev.finalTime && row.finalTime === prev.finalTime) ||
          (row.finalDistance != null && prev.finalDistance != null && row.finalDistance === prev.finalDistance) ||
          (row.finalHeight != null && prev.finalHeight != null && row.finalHeight === prev.finalHeight) ||
          (row.finalIaafPoints != null && prev.finalIaafPoints != null && row.finalIaafPoints === prev.finalIaafPoints);
        if (!tied) rank = i + 1;
      }
      return { ...row, rankPosition: rank };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Sincronizar con score_table usando externalEventId
  // ─────────────────────────────────────────────────────────────
  private async syncScoreTable(
    phaseId: number,
    phase: Phase,
    phaseRegs: PhaseRegistration[],
    classifications: AthleticsPhaseClassification[],
    externalEventId: number,
    externalSportId: number,   
    localSportId: number,        
  ):  Promise<void> {
    const institutionByPrId = new Map<
        number,
        { institutionId: number; externalId: number | null; name: string }
    >();

    for (const pr of phaseRegs) {
        const reg = (pr as any).registration;
        const inst = reg?.athlete?.institution ?? reg?.team?.institution;
        if (inst && reg.externalInstitutionId) {
        institutionByPrId.set(pr.phaseRegistrationId, {
            institutionId: reg.externalInstitutionId,  // ← ID de sismaster
            externalId:    reg.externalInstitutionId,
            name:          inst.name ?? 'N/A',
        });
        }
    }

    const isCombinedOrRelay = COMBINED_PHASE_TYPES.includes(phase.type) || phase.isRelay;

    for (const cls of classifications) {
        if (
        !cls.isScoringEligible ||
        cls.rankPosition == null ||
        cls.rankPosition > 8 ||
        cls.pointsAwarded === 0
        ) continue;

        const inst = institutionByPrId.get(cls.phaseRegistrationId);
        if (!inst) continue;

        await this.scoreTablesService.accumulateScore({
        externalEventId,
        externalSportId,
        localSportId,
        institutionId:         inst.institutionId,  
        externalInstitutionId: inst.externalId,
        institutionName:       inst.name,
        gender:                phase.gender,
        level:                 phase.level,
        rankPosition:          cls.rankPosition,
        isRelayOrCombined:     isCombinedOrRelay,
        });
    }
    }


  // ─────────────────────────────────────────────────────────────
  // Utilidades de tiempo
  // ─────────────────────────────────────────────────────────────
  private compareTime(a: string, b: string): number {
    return this.timeToMs(a) - this.timeToMs(b);
  }

  private timeToMs(time: string): number {
    const parts = time.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60000 + parseFloat(parts[1]) * 1000;
    }
    return parseFloat(time) * 1000;
  }

  // ─────────────────────────────────────────────────────────────
  // GET: ranking clasificado de una fase
  // ─────────────────────────────────────────────────────────────
  async getClassification(phaseId: number) {
    return this.classificationRepo.find({
      where: { phaseId },
      order: { rankPosition: 'ASC' },
      relations: ['phaseRegistration', 'phaseRegistration.registration'],
    });
  }

  // Corrección manual de rank_position (edge cases)
  async overrideRank(
    phaseRegistrationId: number,
    rankPosition: number,
  ): Promise<AthleticsPhaseClassification> {
    const cls = await this.classificationRepo.findOne({
      where: { phaseRegistrationId },
    });
    if (!cls) throw new NotFoundException('Clasificación no encontrada');

    const basePoints = POINTS_BY_RANK[rankPosition] ?? 0;
    cls.rankPosition  = rankPosition;
    cls.pointsAwarded = basePoints;
    cls.resultSource  = 'manual';

    return this.classificationRepo.save(cls);
  }
}