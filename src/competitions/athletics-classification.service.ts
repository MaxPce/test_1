// src/competitions/athletics-classification.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AthleticsPhaseClassification } from './entities/athletics-phase-classification.entity';
import { AthleticsResult } from './entities/athletics-result.entity';
import { AthleticsSectionEntry } from './entities/athletics-section-entry.entity';
import { AthleticsSection } from './entities/athletics-section.entity';
import { PhaseRegistration } from './entities/phase-registration.entity';
import { Phase } from './entities/phase.entity';
import { ScoreTablesService } from '../score-tables/score-tables.service';
import { PhaseType, PhaseGender } from '../common/enums';

const POINTS_BY_RANK: Record<number, number> = {
  1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

// Tipos de fase que implican doble puntaje (regla 3.5.3)
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
  // Llama esto cuando el operador "cierra" una fase
  // ─────────────────────────────────────────────────────────────
  async classifyPhase(phaseId: number): Promise<AthleticsPhaseClassification[]> {
    const phase = await this.phaseRepo.findOne({
      where: { phaseId },
      relations: ['eventCategory', 'eventCategory.event'],
    });
    if (!phase) throw new NotFoundException(`Phase #${phaseId} no encontrada`);

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

    // 1. Obtener la marca final de cada atleta según el tipo de fase
    const marks = await this.resolveMarks(phase, prIds);

    // 2. Ordenar y asignar rank_position
    const ranked = this.rankMarks(marks, phase.type);

    // 3. Determinar si la prueba puntúa (regla 3.5.7: mínimo 2 universidades)
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
      const pointsAwarded = isCombinedOrRelay && isScoringEligible
        ? basePoints * 2
        : isScoringEligible ? basePoints : 0;

      // Upsert en athletics_phase_classification
      const existing = await this.classificationRepo.findOne({
        where: { phaseRegistrationId: row.phaseRegistrationId },
      });

      const entity = existing ?? this.classificationRepo.create({
        phaseId,
        phaseRegistrationId: row.phaseRegistrationId,
      });

      entity.rankPosition       = row.rankPosition <= 8 ? row.rankPosition : null;
      entity.pointsAwarded      = pointsAwarded;
      entity.isScoringEligible  = isScoringEligible;
      entity.exclusionReason    = isScoringEligible
        ? null
        : 'Solo una universidad participante (regla 3.5.7)';
      entity.finalTime          = row.finalTime ?? null;
      entity.finalDistance      = row.finalDistance ?? null;
      entity.finalHeight        = row.finalHeight ?? null;
      entity.finalIaafPoints    = row.finalIaafPoints ?? null;
      entity.resultSource       = row.resultSource;

      saved.push(await this.classificationRepo.save(entity));
    }

    // 5. Actualizar score_table: primero limpiar los aportes anteriores de esta fase
    //    y luego re-acumular desde las clasificaciones guardadas
    const eventId = phase.eventCategory?.eventId;
    if (eventId) {
      await this.syncScoreTable(phaseId, phase, phaseRegs, saved, eventId);
    }

    return saved;
  }

  // ─────────────────────────────────────────────────────────────
  // Obtener la marca final según el tipo de fase
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
      case PhaseType.GRUPO:
      case PhaseType.ELIMINACION:
        // Carreras: buscar en sección llamada "Finales" primero, sino mejor_serie
        return this.resolveTrackMarks(phase.phaseId, prIds);

      case PhaseType.COMBINED_DISTANCIA:
        // Saltos y lanzamientos: mejor intento válido de distance_value
        return this.resolveDistanceMarks(prIds);

      case PhaseType.COMBINED_ALTURA:
        // Salto alto / garrocha: mejor altura superada
        return this.resolveHeightMarks(prIds);

      case PhaseType.COMBINED_PISTA:
        // Heptatlón / Decatlón: suma de iaaf_points por combinedEvent
        return this.resolveCombinedEventMarks(prIds);

      default:
        return this.resolveTrackMarks(phase.phaseId, prIds);
    }
  }

  // Carreras: prioriza sección "finales" (case-insensitive), fallback a mejor tiempo de cualquier sección
  private async resolveTrackMarks(
    phaseId: number,
    prIds: number[],
  ) {
    const sections = await this.athleticsSectionRepo.find({ where: { phaseId } });
    const finalSection = sections.find(
      (s) => s.name.toLowerCase().includes('final'),
    );

    const allEntries = await this.sectionEntryRepo
      .createQueryBuilder('se')
      .where('se.phaseRegistrationId IN (:...prIds)', { prIds })
      .andWhere('se.time IS NOT NULL')
      .getMany();

    // Separar entries de "Finales" vs el resto
    const finalsEntries = finalSection
      ? allEntries.filter((e) => e.athleticsSectionId === finalSection.athleticsSectionId)
      : [];

    const result = new Map<number, {
      finalTime: string;
      resultSource: AthleticsPhaseClassification['resultSource'];
    }>();

    // Primero asignar de Finales
    for (const e of finalsEntries) {
      if (e.time) {
        result.set(e.phaseRegistrationId, {
          finalTime: e.time,
          resultSource: 'finales',
        });
      }
    }

    // Para los que no tienen Finales, buscar mejor tiempo en series
    for (const e of allEntries) {
      if (!result.has(e.phaseRegistrationId) && e.time) {
        const current = result.get(e.phaseRegistrationId);
        if (
          !current ||
          this.compareTime(e.time, current.finalTime) < 0
        ) {
          result.set(e.phaseRegistrationId, {
            finalTime: e.time,
            resultSource: 'mejor_serie',
          });
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

  // Saltos/lanzamientos: mejor intento válido (distance_value)
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

  // Salto alto/garrocha: mejor altura con resultado 'O'
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

  // Heptatlón/Decatlón: suma total de iaaf_points
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
  // Ordenar marcas y asignar rank_position
  // ─────────────────────────────────────────────────────────────
  private rankMarks(
    marks: Array<any>,
    phaseType: PhaseType,
  ): Array<any & { rankPosition: number }> {
    const isTrackOrCombined =
      phaseType === PhaseType.COMBINED_PISTA ||
      phaseType === PhaseType.GRUPO ||
      phaseType === PhaseType.ELIMINACION;

    const sorted = [...marks].sort((a, b) => {
      // Carreras: menor tiempo es mejor
      if (a.finalTime && b.finalTime) {
        return this.compareTime(a.finalTime, b.finalTime);
      }
      // Combinados por puntos IAAF: mayor es mejor
      if (a.finalIaafPoints != null && b.finalIaafPoints != null) {
        return b.finalIaafPoints - a.finalIaafPoints;
      }
      // Distancia/altura: mayor es mejor
      const valA = a.finalDistance ?? a.finalHeight ?? 0;
      const valB = b.finalDistance ?? b.finalHeight ?? 0;
      return valB - valA;
    });

    let rank = 1;
    return sorted.map((row, i) => {
      if (i > 0) {
        const prev = sorted[i - 1];
        const sameTime = row.finalTime && prev.finalTime && row.finalTime === prev.finalTime;
        const sameDist =
          row.finalDistance != null &&
          prev.finalDistance != null &&
          row.finalDistance === prev.finalDistance;
        const sameHeight =
          row.finalHeight != null &&
          prev.finalHeight != null &&
          row.finalHeight === prev.finalHeight;
        const sameIaaf =
          row.finalIaafPoints != null &&
          prev.finalIaafPoints != null &&
          row.finalIaafPoints === prev.finalIaafPoints;
        if (!sameTime && !sameDist && !sameHeight && !sameIaaf) rank = i + 1;
      }
      return { ...row, rankPosition: rank };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Sincronizar con score_table
  // ─────────────────────────────────────────────────────────────
  private async syncScoreTable(
    phaseId: number,
    phase: Phase,
    phaseRegs: PhaseRegistration[],
    classifications: AthleticsPhaseClassification[],
    eventId: number,
  ): Promise<void> {
    // Mapa de phaseRegistrationId → institución
    const institutionByPrId = new Map<
      number,
      { institutionId: number; externalId: number | null; name: string }
    >();

    for (const pr of phaseRegs) {
      const reg = (pr as any).registration;
      const inst = reg?.athlete?.institution ?? reg?.team?.institution;
      if (inst) {
        institutionByPrId.set(pr.phaseRegistrationId, {
          institutionId: inst.institutionId,
          externalId: reg.externalInstitutionId ?? null,
          name: inst.name ?? 'N/A',
        });
      }
    }

    const isCombinedOrRelay =
      COMBINED_PHASE_TYPES.includes(phase.type) || phase.isRelay;

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
        eventId,
        institutionId: inst.institutionId,
        externalInstitutionId: inst.externalId ?? undefined, // ← null → undefined
        institutionName: inst.name,
        gender: phase.gender,
        level: phase.level,
        rankPosition: cls.rankPosition,
        isRelayOrCombined: isCombinedOrRelay,
        });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Comparar tiempos en formato "m:ss.ms" o "ss.ms"
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

  // Corrección manual de un rank_position (edge cases)
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