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
}
