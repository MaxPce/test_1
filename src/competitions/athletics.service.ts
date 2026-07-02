import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { AthleticsResult } from './entities/athletics-result.entity';
import { PhaseRegistration } from './entities/phase-registration.entity';
import { CreateAthleticsResultDto } from './dto/create-athletics-result.dto';
import { UpdateAthleticsResultDto } from './dto/update-athletics-result.dto';
import { AthleticsSection } from './entities/athletics-section.entity';
import {
  CreateAthleticsSectionDto,
  UpdateAthleticsSectionDto,
} from './dto/athletics-section.dto';
import { AthleticsSectionEntry } from './entities/athletics-section-entry.entity';
import {
  AssignSectionEntriesDto,
  UpsertSectionEntryDto,
} from './dto/athletics-section-entry.dto';
import { Phase } from './entities/phase.entity';
import { PhaseType } from '../common/enums';
import { GenerateAthleticsSeriesDto } from './dto/generate-athletics-series.dto';
import { MoveEntrySectionDto } from './dto/move-entry-section.dto';
import { UpdatePhaseSettingsDto } from './dto/update-phase-settings.dto';

@Injectable()
export class AthleticsService {
  constructor(
    @InjectRepository(AthleticsResult)
    private readonly athleticsResultRepo: Repository<AthleticsResult>,

    @InjectRepository(AthleticsSection)
    private readonly athleticsSectionRepo: Repository<AthleticsSection>,

    @InjectRepository(AthleticsSectionEntry)
    private readonly sectionEntryRepo: Repository<AthleticsSectionEntry>,

    @InjectRepository(PhaseRegistration)
    private readonly phaseRegistrationRepo: Repository<PhaseRegistration>,

    @InjectRepository(Phase)
    private readonly phaseRepo: Repository<Phase>,
  ) {}

  // ── Crear resultado / intento ─────────────────────────────────────
  async create(dto: CreateAthleticsResultDto): Promise<AthleticsResult> {
    const phaseReg = await this.phaseRegistrationRepo.findOne({
      where: { phaseRegistrationId: dto.phaseRegistrationId },
    });
    if (!phaseReg) {
      throw new NotFoundException(
        `PhaseRegistration #${dto.phaseRegistrationId} no encontrado`,
      );
    }

    if (dto.attemptNumber != null) {
      const existing = await this.athleticsResultRepo.findOne({
        where: {
          phaseRegistrationId: dto.phaseRegistrationId,
          attemptNumber: dto.attemptNumber,
          ...(dto.height != null
            ? { height: dto.height } // salto alto / garrocha
            : {
                combinedEvent: dto.combinedEvent ? dto.combinedEvent : IsNull(),
              }), // distancia / combinado
        },
      });
    }

    const result = this.athleticsResultRepo.create({
      phaseRegistrationId: dto.phaseRegistrationId,
      lane: dto.lane ?? null,
      time: dto.time ?? null,
      wind: dto.wind ?? null,
      notes: dto.notes ?? null,
      attemptNumber: dto.attemptNumber ?? null,
      distanceValue: dto.distanceValue ?? null,
      isValid: dto.isValid ?? true,
      height: dto.height ?? null,
      heightResult: dto.heightResult ?? null,
      combinedEvent: dto.combinedEvent ?? null,
      rawValue: dto.rawValue ?? null,
      iaafPoints: dto.iaafPoints ?? null,
    });

    return this.athleticsResultRepo.save(result);
  }

  // ── Todos los intentos de un phase_registration ───────────────────
  async findByPhaseRegistration(
    phaseRegistrationId: number,
  ): Promise<AthleticsResult[]> {
    return this.athleticsResultRepo.find({
      where: { phaseRegistrationId },
      order: { attemptNumber: 'ASC', combinedEvent: 'ASC', createdAt: 'ASC' },
    });
  }

  // ── Todos los resultados de una fase (ranking completo) ───────────
  async findByPhase(phaseId: number): Promise<AthleticsResult[]> {
    return this.athleticsResultRepo
      .createQueryBuilder('ar')
      .innerJoin('ar.phaseRegistration', 'pr')
      .innerJoin('pr.phase', 'ph')
      .innerJoin('pr.registration', 'reg')
      .leftJoin('reg.participant', 'participant')
      .where('ph.phaseId = :phaseId', { phaseId })
      .select([
        'ar',
        'pr.phaseRegistrationId',
        'pr.registrationId',
        'reg.registrationId',
        'participant',
      ])
      .orderBy('ar.phaseRegistrationId', 'ASC')
      .addOrderBy('ar.attemptNumber', 'ASC')
      .getMany();
  }

  // ── Ranking carreras por sección ──────────────────────────────────
  async getRankingTrack(phaseId: number, sectionId?: number): Promise<any[]> {
    const qb = this.sectionEntryRepo
      .createQueryBuilder('se')
      .innerJoin('se.phaseRegistration', 'pr')
      .innerJoin('pr.phase', 'ph')
      .innerJoin('se.athleticsSection', 'sec')
      .where('ph.phaseId = :phaseId', { phaseId })
      .andWhere('se.time IS NOT NULL')
      .select([
        'se.entryId          AS entryId',
        'se.phaseRegistrationId AS phaseRegistrationId',
        'se.athleticsSectionId  AS athleticsSectionId',
        'sec.name               AS sectionName',
        'se.lane                AS lane',
        'se.time                AS time',
        'se.wind                AS wind',
      ]);

    if (sectionId) {
      qb.andWhere('se.athleticsSectionId = :sectionId', { sectionId });
    }

    return qb
      .orderBy('se.athleticsSectionId', 'ASC')
      .addOrderBy('se.time', 'ASC')
      .getRawMany();
  }

  // ── Ranking saltos/lanzamientos (mejor intento válido) ────────────
  async getRankingField(phaseId: number): Promise<AthleticsResult[]> {
    const results = await this.athleticsResultRepo
      .createQueryBuilder('ar')
      .innerJoin('ar.phaseRegistration', 'pr')
      .innerJoin('pr.phase', 'ph')
      .where('ph.phaseId = :phaseId', { phaseId })
      .andWhere('ar.distance_value IS NOT NULL')
      .andWhere('ar.is_valid = 1')
      .getMany();

    const grouped = new Map<number, AthleticsResult>();
    for (const r of results) {
      const current = grouped.get(r.phaseRegistrationId);
      if (!current || Number(r.distanceValue) > Number(current.distanceValue)) {
        grouped.set(r.phaseRegistrationId, r);
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) => Number(b.distanceValue) - Number(a.distanceValue),
    );
  }

  // ── Uno por id ────────────────────────────────────────────────────
  async findOne(id: number): Promise<AthleticsResult> {
    const result = await this.athleticsResultRepo.findOne({
      where: { athleticsResultId: id },
      relations: ['phaseRegistration'],
    });
    if (!result) {
      throw new NotFoundException(`AthleticsResult #${id} no encontrado`);
    }
    return result;
  }

  // ── Actualizar ────────────────────────────────────────────────────
  async update(
    id: number,
    dto: UpdateAthleticsResultDto,
  ): Promise<AthleticsResult> {
    const result = await this.findOne(id);
    Object.assign(result, dto);
    return this.athleticsResultRepo.save(result);
  }

  // ── Eliminar uno ──────────────────────────────────────────────────
  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const result = await this.findOne(id);
    await this.athleticsResultRepo.remove(result);
    return { deleted: true, id };
  }

  // ── Reset: borrar todos los intentos de un registro ───────────────
  async resetPhaseRegistration(
    phaseRegistrationId: number,
  ): Promise<{ deleted: number }> {
    const results = await this.findByPhaseRegistration(phaseRegistrationId);
    await this.athleticsResultRepo.remove(results);
    return { deleted: results.length };
  }

  // ── Quitar atleta de la fase (elimina el PhaseRegistration y sus resultados) ──
  async removePhaseRegistration(
    phaseRegistrationId: number,
  ): Promise<{ deleted: boolean }> {
    const reg = await this.phaseRegistrationRepo.findOne({
      where: { phaseRegistrationId },
    });
    if (!reg) {
      throw new NotFoundException(
        `PhaseRegistration #${phaseRegistrationId} no encontrado`,
      );
    }

    // Primero borrar todos los intentos asociados
    const attempts = await this.athleticsResultRepo.find({
      where: { phaseRegistrationId },
    });
    if (attempts.length > 0) {
      await this.athleticsResultRepo.remove(attempts);
    }

    // Luego borrar la inscripción de fase
    await this.phaseRegistrationRepo.remove(reg);
    return { deleted: true };
  }

  async findFullTrackTable(phaseId: number): Promise<any[]> {
    const phaseRegs = await this.phaseRegistrationRepo.find({
      where: { phaseId },
      relations: [
        'registration',
        'registration.athlete',
        'registration.athlete.institution',
        'registration.team',
        'registration.team.institution',
        'registration.team.members',            
        'registration.team.members.athlete',    
      ],
    });

    if (phaseRegs.length === 0) return [];

    const prIds = phaseRegs.map((pr) => pr.phaseRegistrationId);

    const entries = await this.sectionEntryRepo.find({
      where: { phaseRegistrationId: In(prIds) },
      relations: ['athleticsSection'],
    });

    const entriesMap = new Map<number, AthleticsSectionEntry[]>();
    for (const e of entries) {
      const list = entriesMap.get(e.phaseRegistrationId) ?? [];
      list.push(e);
      entriesMap.set(e.phaseRegistrationId, list);
    }

    const results = await this.athleticsResultRepo.find({
      where: { phaseRegistrationId: In(prIds) },
    });
    const resultMap = new Map(results.map((r) => [r.phaseRegistrationId, r]));

    return phaseRegs.map((pr) => {
      const reg = (pr as any).registration;
      const athlete = reg?.athlete;
      const team = reg?.team;
      const institution = athlete?.institution ?? team?.institution;
      const members = team?.members ?? [];
      const result = resultMap.get(pr.phaseRegistrationId);
      const athleteEntries = entriesMap.get(pr.phaseRegistrationId) ?? [];

      return {
        phaseRegistrationId: pr.phaseRegistrationId,
        registrationId: pr.registrationId,
        athleteName:
          athlete?.name ?? team?.name ?? `Registro ${pr.registrationId}`,
        institutionName: institution?.name ?? '',
        institutionLogo: institution?.logoUrl ?? null,
        isTeam: !athlete && !!team,
        athleticsResultId: result?.athleticsResultId ?? null,
        time: result?.time ?? null,
        sections: athleteEntries.map((e) => ({
          entryId: e.entryId,
          athleticsSectionId: e.athleticsSectionId,
          sectionName: e.athleticsSection?.name ?? '',
          lane: e.lane,
          time: e.time,
          wind: e.wind,
          notes: e.notes,
        })),
        teamMembers: team
          ? members.map((m) => ({
              athleteId: m.athleteId,
              name: m.athlete?.name ?? `Atleta ${m.athleteId}`,
              rol: m.rol ?? 'titular',
            }))
          : [],

      };
    });
  }

  async getSectionsByPhase(phaseId: number) {
    return this.athleticsSectionRepo.find({
      where: { phaseId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createSection(dto: CreateAthleticsSectionDto) {
    const existing = await this.athleticsSectionRepo.findOne({
      where: { phaseId: dto.phaseId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Ya existe una sección con ese nombre');
    }
    const section = this.athleticsSectionRepo.create({
      phaseId: dto.phaseId,
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.athleticsSectionRepo.save(section);
  }

  async updateSection(id: number, dto: UpdateAthleticsSectionDto) {
    const section = await this.athleticsSectionRepo.findOneOrFail({
      where: { athleticsSectionId: id },
    });
    if (dto.name !== undefined) section.name = dto.name;
    if (dto.sortOrder !== undefined) section.sortOrder = dto.sortOrder;
    if (dto.wind !== undefined) section.wind = dto.wind; // ← nuevo
    return this.athleticsSectionRepo.save(section);
  }

  async deleteSection(id: number) {
    await this.athleticsSectionRepo.findOneOrFail({
      where: { athleticsSectionId: id },
    });
    await this.athleticsSectionRepo.delete(id);
    return { deleted: true };
  }

  async assignSectionEntries(dto: AssignSectionEntriesDto) {
    if (dto.toAdd.length > 0) {
      const entries = dto.toAdd.map((phaseRegistrationId) =>
        this.sectionEntryRepo.create({
          athleticsSectionId: dto.athleticsSectionId,
          phaseRegistrationId,
        }),
      );
      await this.sectionEntryRepo
        .createQueryBuilder()
        .insert()
        .into(AthleticsSectionEntry)
        .values(entries)
        .orIgnore()
        .execute();
    }

    if (dto.toRemove.length > 0) {
      await this.sectionEntryRepo.delete({
        athleticsSectionId: dto.athleticsSectionId,
        phaseRegistrationId: In(dto.toRemove),
      });
    }

    return { ok: true };
  }

  // guardar lane/time/wind de una entry específica:
  async upsertSectionEntry(dto: UpsertSectionEntryDto) {
    const existing = await this.sectionEntryRepo.findOne({
      where: {
        athleticsSectionId: dto.athleticsSectionId,
        phaseRegistrationId: dto.phaseRegistrationId,
      },
    });

    if (existing) {
      if (dto.lane !== undefined) existing.lane = dto.lane ?? null;
      if (dto.time !== undefined) existing.time = dto.time ?? null;
      if (dto.wind !== undefined) existing.wind = dto.wind ?? null;
      if (dto.notes !== undefined) existing.notes = dto.notes ?? null;
      return this.sectionEntryRepo.save(existing);
    }

    const entry = this.sectionEntryRepo.create({
      athleticsSectionId: dto.athleticsSectionId,
      phaseRegistrationId: dto.phaseRegistrationId,
      lane: dto.lane ?? null,
      time: dto.time ?? null,
      wind: dto.wind ?? null,
      notes: dto.notes ?? null,
    });
    return this.sectionEntryRepo.save(entry);
  }

  async findFullFieldTable(phaseId: number): Promise<any[]> {
    const phaseRegs = await this.phaseRegistrationRepo.find({
      where: { phaseId },
      relations: [
        'registration',
        'registration.athlete',
        'registration.athlete.institution',
        'registration.team',
        'registration.team.institution',
        'registration.team.members',            
        'registration.team.members.athlete',    
      ],
    });

    if (phaseRegs.length === 0) return [];

    const prIds = phaseRegs.map((pr) => pr.phaseRegistrationId);

    // Todos los intentos de todos los atletas de la fase
    const attempts = await this.athleticsResultRepo.find({
      where: { phaseRegistrationId: In(prIds) },
      order: { attemptNumber: 'ASC', combinedEvent: 'ASC' },
    });

    // Agrupar intentos por atleta
    const attemptsMap = new Map<number, AthleticsResult[]>();
    for (const a of attempts) {
      const list = attemptsMap.get(a.phaseRegistrationId) ?? [];
      list.push(a);
      attemptsMap.set(a.phaseRegistrationId, list);
    }

    return phaseRegs.map((pr) => {
      const reg = (pr as any).registration;
      const athlete = reg?.athlete;
      const team = reg?.team;
      const institution = athlete?.institution ?? team?.institution;
      const athleteAttempts = attemptsMap.get(pr.phaseRegistrationId) ?? [];

      // Mejor intento válido (distancia)
      const validAttempts = athleteAttempts.filter(
        (a) => a.isValid && a.distanceValue != null,
      );
      const bestDistance =
        validAttempts.length > 0
          ? Math.max(...validAttempts.map((a) => Number(a.distanceValue)))
          : null;

      // Mejor altura (O/X/-)
      const passedHeights = athleteAttempts
        .filter((a) => a.heightResult === 'O' && a.height != null)
        .map((a) => Number(a.height));
      const bestHeight =
        passedHeights.length > 0 ? Math.max(...passedHeights) : null;

      return {
        phaseRegistrationId: pr.phaseRegistrationId,
        registrationId: pr.registrationId,
        athleteName:
          athlete?.name ?? team?.name ?? `Registro ${pr.registrationId}`,
        institutionName: institution?.name ?? '',
        institutionLogo: institution?.logoUrl ?? null,
        isTeam: !athlete && !!team,
        attempts: athleteAttempts.map((a) => ({
          athleticsResultId: a.athleticsResultId,
          attemptNumber: a.attemptNumber,
          distanceValue: a.distanceValue ? Number(a.distanceValue) : null,
          isValid: a.isValid,
          wind: a.wind ? Number(a.wind) : null,
          height: a.height ? Number(a.height) : null,
          heightResult: a.heightResult,
          notes: a.notes,
        })),
        bestDistance,
        bestHeight,
      };
    });
  }

  async generateAthleticsPhasesBySeries(
    eventCategoryId: number,
    dto: GenerateAthleticsSeriesDto,
  ): Promise<{ created: number; phaseIds: number[] }> {
    if (!dto.groups?.length) {
      throw new BadRequestException('Debe enviar al menos un grupo de series');
    }

    const phaseIds: number[] = [];

    for (const group of dto.groups) {
      if (!group.registrationIds?.length) continue;

      // Crear la fase
      const phase = this.phaseRepo.create({
        eventCategoryId,
        name: group.name,
        type: dto.phaseType ?? PhaseType.GRUPO,
      });
      const savedPhase = await this.phaseRepo.save(phase);

      // Asignar los inscritos a la fase (PhaseRegistrations)
      const phaseRegs = group.registrationIds.map((registrationId) =>
        this.phaseRegistrationRepo.create({
          phaseId: savedPhase.phaseId,
          registrationId,
        }),
      );
      await this.phaseRegistrationRepo.save(phaseRegs);

      phaseIds.push(savedPhase.phaseId);
    }

    return { created: phaseIds.length, phaseIds };
  }

  async moveEntryToSection(
    entryId: number,
    dto: MoveEntrySectionDto,
  ): Promise<{ entryId: number; athleticsSectionId: number }> {
    // 1. Verificar que existe
    const entry = await this.sectionEntryRepo.findOne({
      where: { entryId },
      relations: ['athleticsSection'],
    });
    if (!entry) {
      throw new NotFoundException(`Entry #${entryId} no encontrada`);
    }

    // 2. Verificar sección destino
    const targetSection = await this.athleticsSectionRepo.findOne({
      where: { athleticsSectionId: dto.athleticsSectionId },
    });
    if (!targetSection) {
      throw new NotFoundException(`Sección #${dto.athleticsSectionId} no encontrada`);
    }

    // 3. Verificar misma fase
    if (entry.athleticsSection.phaseId !== targetSection.phaseId) {
      throw new BadRequestException('No se puede mover un atleta a una sección de otra fase');
    }

    await this.sectionEntryRepo.update(
      { entryId },
      { athleticsSectionId: dto.athleticsSectionId },
    );

    return { entryId, athleticsSectionId: dto.athleticsSectionId };
  }

  async updatePhaseSettings(
    phaseId: number,
    dto: UpdatePhaseSettingsDto,
  ): Promise<Phase> {
    const phase = await this.phaseRepo.findOne({ where: { phaseId } });
    if (!phase) throw new NotFoundException(`Phase #${phaseId} no encontrada`);

    if (dto.gender   !== undefined) phase.gender  = dto.gender;
    if (dto.level    !== undefined) phase.level   = dto.level;
    if (dto.isRelay  !== undefined) phase.isRelay = dto.isRelay;

    return this.phaseRepo.save(phase);
  }

  async getResultsByEvent(externalEventId: number, localSportId: number) {
    const rows: Array<{
      eventCategoryId: number;
      eventName: string;
      gender: string | null;   // 'damas' | 'varones' | 'mixto' | null
      level: string | null;    // 'avanzados' | 'noveles' | null
      rankPosition: number;
      athleteName: string;
      institutionName: string;
      institutionAbrev: string | null;
      finalTime: string | null;
      finalDistance: string | null;
      finalHeight: string | null;
      finalIaafPoints: number | null;
      wind: string | null;
      pointsAwarded: number;
      isRelay: boolean;
    }> = await this.athleticsResultRepo.query(
      `SELECT
          ec.event_category_id                                  AS eventCategoryId,
          ph.name                                               AS eventName,
          ph.gender                                             AS gender,
          ph.level                                              AS level,
          ph.is_relay                                           AS isRelay,
          apc.rank_position                                     AS rankPosition,
          apc.points_awarded                                    AS pointsAwarded,
          apc.final_time                                        AS finalTime,
          apc.final_distance                                    AS finalDistance,
          apc.final_height                                      AS finalHeight,
          apc.final_iaaf_points                                 AS finalIaafPoints,
          (
            SELECT ar2.wind
            FROM athletics_result ar2
            WHERE ar2.phase_registration_id = pr.phase_registration_id
              AND ar2.wind IS NOT NULL
            ORDER BY ar2.athletics_result_id DESC
            LIMIT 1
          )                                                     AS wind,
          COALESCE(a.name, tm.name)                             AS athleteName,
          COALESCE(inst.name,   t_inst.name,   'N/A')           AS institutionName,
          COALESCE(inst.abrev,  t_inst.abrev,  '')              AS institutionAbrev
        FROM athletics_phase_classification apc
          INNER JOIN phase_registrations pr ON pr.phase_registration_id = apc.phase_registration_id
          INNER JOIN phases ph              ON ph.phase_id = apc.phase_id
          INNER JOIN event_categories ec    ON ec.event_category_id = ph.event_category_id
          INNER JOIN sports s               ON s.sismaster_sport_id = ec.external_sport_id
          INNER JOIN registrations reg      ON reg.registration_id = pr.registration_id
          LEFT  JOIN athletes a             ON a.athlete_id = reg.athlete_id
          LEFT  JOIN institutions inst      ON inst.institution_id = a.institution_id
          LEFT  JOIN teams tm               ON tm.team_id = reg.team_id
          LEFT  JOIN institutions t_inst    ON t_inst.institution_id = tm.institution_id
        WHERE ec.external_event_id = ?
          AND s.sport_id            = ?
          AND apc.rank_position IS NOT NULL
          AND apc.rank_position BETWEEN 1 AND 10
          AND ph.deleted_at IS NULL
          AND ph.level IS NOT NULL
          AND ph.gender IS NOT NULL
        ORDER BY ph.level, ph.gender, ph.display_order, ph.name, apc.rank_position`,
      [externalEventId, localSportId],
    );

    // ── Marca legible según tipo de prueba ──────────────────────────────────
    const formatMark = (row: (typeof rows)[0]): string => {
      if (row.finalIaafPoints) return `${row.finalIaafPoints} pts`;
      if (row.finalTime)       return row.finalTime;
      if (row.finalDistance)   return `${parseFloat(row.finalDistance).toFixed(2)} m`;
      if (row.finalHeight)     return `${parseFloat(row.finalHeight).toFixed(2)} m`;
      return '–';
    };

    // ── Normaliza level → 'AVANZADOS' | 'NOVELES' ──────────────────────────
    const normalizeLevel = (raw: string | null): 'AVANZADOS' | 'NOVELES' => {
      const v = (raw ?? '').toLowerCase().trim();
      return v === 'noveles' ? 'NOVELES' : 'AVANZADOS';
    };

    // ── Agrupar: category → eventCategoryId → { eventName, female[], male[] }
    const grouped: Record<
      string,
      Record<number, { eventName: string; female: object[]; male: object[] }>
    > = {};

    for (const row of rows) {
      const cat = normalizeLevel(row.level);
      const catId = Number(row.eventCategoryId);
      const gen = (row.gender ?? '').toLowerCase().trim(); // 'damas' | 'varones' | 'mixto'

      grouped[cat] ??= {};

      if (!grouped[cat][catId]) {
        // Nombre limpio: quitar prefijo "Damas Az " / "Varones Nv " etc.
        const cleanName = row.eventName
          .replace(/^\s*(damas|varones)\s+(az|nv)\s+/i, '')
          .replace(/^\s*(damas|varones)\s+/i, '')
          .trim();

        grouped[cat][catId] = { eventName: cleanName, female: [], male: [] };
      }

      const entry = {
        position:        Number(row.rankPosition),
        athleteName:     row.athleteName ?? 'N/A',
        university:      row.institutionName,
        universityAbrev: row.institutionAbrev ?? '',
        mark:            formatMark(row),
        windSpeed:
          row.wind != null
            ? `${Number(row.wind) > 0 ? '+' : ''}${Number(row.wind).toFixed(1)}`
            : null,
        points: Number(row.pointsAwarded),
      };

      if (gen === 'damas')        grouped[cat][catId].female.push(entry);
      else if (gen === 'varones') grouped[cat][catId].male.push(entry);
      else {
        // mixto (postas mixtas): aparece en ambas columnas
        grouped[cat][catId].female.push(entry);
        grouped[cat][catId].male.push(entry);
      }
    }

    // ── Serializar al formato esperado por el frontend ──────────────────────
    return Object.entries(grouped).map(([category, eventsById]) => ({
      category, // 'AVANZADOS' | 'NOVELES'
      events: Object.values(eventsById).map(({ eventName, female, male }) => ({
        eventName,
        femaleResults: female,
        maleResults:   male,
      })),
    }));
  }

  async getParticipatingInstitutions(
    externalEventId: number,
    localSportId: number,
  ): Promise<{ institutionId: number; institutionName: string; institutionAbrev: string | null; logoUrl: string | null }[]> {
    const rows: any[] = await this.athleticsResultRepo.query(
      `SELECT DISTINCT
          COALESCE(inst.institution_id, t_inst.institution_id) AS institutionId,
          COALESCE(inst.name,   t_inst.name,   'N/A')          AS institutionName,
          COALESCE(inst.abrev,  t_inst.abrev,  '')             AS institutionAbrev,
          COALESCE(inst.logo_url, t_inst.logo_url, NULL)       AS logoUrl
        FROM phase_registrations pr
          INNER JOIN phases ph           ON ph.phase_id = pr.phase_id
          INNER JOIN event_categories ec ON ec.event_category_id = ph.event_category_id
          INNER JOIN sports s            ON s.sismaster_sport_id = ec.external_sport_id
          INNER JOIN registrations reg   ON reg.registration_id = pr.registration_id
          LEFT  JOIN athletes a          ON a.athlete_id = reg.athlete_id
          LEFT  JOIN institutions inst   ON inst.institution_id = a.institution_id
          LEFT  JOIN teams tm            ON tm.team_id = reg.team_id
          LEFT  JOIN institutions t_inst ON t_inst.institution_id = tm.institution_id
        WHERE ec.external_event_id = ?
          AND s.sport_id = ?
          AND ph.deleted_at IS NULL
          AND COALESCE(inst.institution_id, t_inst.institution_id) IS NOT NULL`,
      [externalEventId, localSportId],
    );
    return rows;
  }

}
