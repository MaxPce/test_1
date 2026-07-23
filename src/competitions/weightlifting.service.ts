import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeightliftingAttempt } from './entities/weightlifting-attempt.entity';
import { Participation } from './entities/participation.entity';
import { Registration } from '../events/entities/registration.entity';
import { Phase } from './entities/phase.entity';
import { Match } from './entities/match.entity';
import { UpsertWeightliftingAttemptDto } from './dto/create-weightlifting-attempt.dto';

import { MatchStatus } from '../common/enums';
import { PhaseRegistration } from './entities/phase-registration.entity';
import { PhaseType } from '../common/enums';
import { GenerateWeightliftingPhasesDto } from './dto/generate-weightlifting-phases.dto';
import { WeightliftingManualRank } from './entities/weightlifting-manual-rank.entity';

export interface WeightliftingAthleteResult {
  participation: Participation;
  snatchAttempts: WeightliftingAttempt[];
  cleanAndJerkAttempts: WeightliftingAttempt[];
  bestSnatch: number | null;
  bestCleanAndJerk: number | null;
  total: number | null;
  totalAchievedAtAttempt: number | null;
  rank: number | null;
}

@Injectable()
export class WeightliftingService {
  constructor(
    @InjectRepository(WeightliftingAttempt)
    private readonly attemptRepo: Repository<WeightliftingAttempt>,
    @InjectRepository(Participation)
    private readonly participationRepo: Repository<Participation>,
    @InjectRepository(Registration)
    private readonly registrationRepo: Repository<Registration>,
    @InjectRepository(Phase)
    private readonly phaseRepo: Repository<Phase>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(PhaseRegistration)
    private readonly phaseRegistrationRepo: Repository<PhaseRegistration>,
    @InjectRepository(WeightliftingManualRank)
    private readonly manualRankRepo: Repository<WeightliftingManualRank>,
  ) {}


  async getManualRanks(phaseId: number): Promise<WeightliftingManualRank[]> {
    return this.manualRankRepo.find({
      where: { phaseId },
      relations: ['registration', 'registration.athlete', 'registration.athlete.institution'],
    });
  }

  async setManualRanks(
    phaseId: number,
    ranks: { registrationId: number; snatchRank?: number | null; cleanAndJerkRank?: number | null; totalRank?: number | null }[],
  ): Promise<{ updated: number }> {
    let updated = 0;
    for (const item of ranks) {
      await this.manualRankRepo.upsert(
        { phaseId, registrationId: item.registrationId, snatchRank: item.snatchRank ?? null, cleanAndJerkRank: item.cleanAndJerkRank ?? null, totalRank: item.totalRank ?? null },
        ['phaseId', 'registrationId'],
      );
      updated++;
    }
    return { updated };
  }

  async clearManualRanks(phaseId: number): Promise<{ cleared: number }> {
    const result = await this.manualRankRepo.delete({ phaseId });
    return { cleared: result.affected ?? 0 };
  }

  // ── Resultados de la fase ────────────────────────────────────────────────
  async getPhaseResults(phaseId: number): Promise<WeightliftingAthleteResult[]> {
    // 1. Cargar participaciones con relaciones de la fase
    const participations = await this.participationRepo
      .createQueryBuilder('p')
      .innerJoin('p.match', 'match')
      .leftJoinAndSelect('p.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'institution')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .where('match.phaseId = :phaseId', { phaseId })   // ← camelCase, no snake_case
      .andWhere('match.deletedAt IS NULL')               // ← guard para soft-delete
      .getMany();

    if (participations.length === 0) return [];

    const participationIds = participations.map((p) => p.participationId);

    // 2. Cargar todos los intentos de esas participaciones
    const allAttempts = await this.attemptRepo
      .createQueryBuilder('a')
      .where('a.participationId IN (:...ids)', { ids: participationIds })
      .orderBy('a.attemptNumber', 'ASC')
      .getMany();

    // 3. Calcular resultados por participación
    const results: WeightliftingAthleteResult[] = participations.map((p) => {
      const attempts = allAttempts.filter(
        (a) => a.participationId === p.participationId,
      );

      const snatch = attempts
        .filter((a) => a.liftType === 'snatch')
        .sort((a, b) => a.attemptNumber - b.attemptNumber);

      const cnj = attempts
        .filter((a) => a.liftType === 'clean_and_jerk')
        .sort((a, b) => a.attemptNumber - b.attemptNumber);

      const bestSnatch = this.getBestLift(snatch);
      const bestCnj = this.getBestLift(cnj);
      const total =
        bestSnatch !== null && bestCnj !== null ? bestSnatch + bestCnj : null;

      // Desempate IWF W3: intento global en que se completó el total
      const totalAchievedAtAttempt =
        total !== null ? this.getTotalAchievedAttempt(snatch, cnj) : null;

      return {
        participation: p,
        snatchAttempts: snatch,
        cleanAndJerkAttempts: cnj,
        bestSnatch,
        bestCleanAndJerk: bestCnj,
        total,
        totalAchievedAtAttempt,
        rank: null,
      };
    });

    // 4. Ordenar y asignar rank IWF:
    //    - Con total primero, sin total al final (W2)
    //    - Desempate: total DESC → totalAchievedAtAttempt ASC → bodyWeight ASC (si existe)
    results.sort((a, b) => {
      const aHas = a.total !== null;
      const bHas = b.total !== null;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      if (!aHas && !bHas) return 0;

      if (b.total! !== a.total!) return b.total! - a.total!;

      // Desempate W3: menor intento acumulado gana
      const aAttempt = a.totalAchievedAtAttempt ?? 99;
      const bAttempt = b.totalAchievedAtAttempt ?? 99;
      return aAttempt - bAttempt;
    });

    // 5. Asignar rankPosition con soporte de empates
    let currentRank = 1;
    for (let i = 0; i < results.length; i++) {
      if (i > 0) {
        const prev = results[i - 1];
        const tied =
          results[i].total === prev.total &&
          results[i].totalAchievedAtAttempt === prev.totalAchievedAtAttempt;
        if (!tied) currentRank = i + 1;
      }
      results[i].rank = results[i].total !== null ? currentRank : null;
    }

    return results;
  }

  // ── Intentos de una participación ────────────────────────────────────────
  async getParticipationAttempts(
    participationId: number,
  ): Promise<WeightliftingAttempt[]> {
    return this.attemptRepo.find({
      where: { participationId },
      order: { liftType: 'ASC', attemptNumber: 'ASC' },
    });
  }

  // ── Upsert de un intento ─────────────────────────────────────────────────
  async upsertAttempt(
    participationId: number,
    dto: UpsertWeightliftingAttemptDto,
  ): Promise<WeightliftingAttempt> {
    const participation = await this.participationRepo.findOne({
      where: { participationId },
    });
    if (!participation)
      throw new NotFoundException('Participación no encontrada');

    let attempt = await this.attemptRepo.findOne({
      where: {
        participationId,
        liftType: dto.liftType,
        attemptNumber: dto.attemptNumber,
      },
    });

    if (!attempt) {
      attempt = this.attemptRepo.create({ participationId });
    }

    attempt.liftType     = dto.liftType;
    attempt.attemptNumber = dto.attemptNumber;
    attempt.weightKg     = dto.weightKg ?? null;
    attempt.result       = dto.result;

    await this.attemptRepo.save(attempt);

    if (dto.result === 'retired') {
      await this.propagateRetirement(
        participationId,
        dto.liftType,
        dto.attemptNumber,
      );
    }

    return attempt;
  }

  private async propagateRetirement(
    participationId: number,
    liftType: 'snatch' | 'clean_and_jerk',
    fromAttempt: 1 | 2 | 3,
  ): Promise<void> {
    const remaining = ([1, 2, 3] as const).filter((n) => n > fromAttempt);

    for (const num of remaining) {
      let next = await this.attemptRepo.findOne({
        where: { participationId, liftType, attemptNumber: num },
      });

      if (!next) {
        next = this.attemptRepo.create({ participationId });
      }

      next.liftType      = liftType;
      next.attemptNumber = num;
      next.weightKg      = null;
      next.result        = 'retired';

      await this.attemptRepo.save(next);
    }
  }

  // ── Inicializar fase con atletas y divisiones ────────────────────────────
  async initializePhase(
    phaseId: number,
    entries: { registrationId: number; weightClass?: string | null }[],
  ): Promise<{ message: string; participationsCreated: number }> {
    const phase = await this.phaseRepo.findOne({ where: { phaseId } });
    if (!phase) throw new NotFoundException(`Phase ${phaseId} no encontrada`);

    // Crear o reusar el match único de la fase
    let match = await this.matchRepo.findOne({ where: { phaseId } });
    if (!match) {
      match = this.matchRepo.create({
        phaseId,
        matchNumber: 1,
        round: 'Final',
        status: MatchStatus.EN_CURSO,
      });
      match = await this.matchRepo.save(match);
    }

    // Filtrar los que ya estaban asignados (idempotente)
    const existing = await this.participationRepo.find({
      where: { matchId: match.matchId },
    });
    const existingRegIds = new Set(existing.map((p) => p.registrationId));
    const newEntries = entries.filter((e) => !existingRegIds.has(e.registrationId));

    if (newEntries.length === 0) {
      return {
        message: 'Todos los atletas ya estaban asignados',
        participationsCreated: 0,
      };
    }

    // Guardar weightClass en la registration
    for (const entry of newEntries) {
      if (entry.weightClass !== undefined) {
        await this.registrationRepo.update(
          { registrationId: entry.registrationId },
          { weightClass: entry.weightClass ?? null },
        );
      }
    }

    // Crear participations nuevas
    const participations = newEntries.map((e) =>
      this.participationRepo.create({
        matchId: match.matchId,
        registrationId: e.registrationId,
      }),
    );
    await this.participationRepo.save(participations);

    return {
      message: 'Fase inicializada correctamente',
      participationsCreated: newEntries.length,
    };
  }

  // ── Generación automática de múltiples fases ─────────────────────────────
  async generatePhases(
    dto: GenerateWeightliftingPhasesDto,
  ): Promise<{ created: number; phaseIds: number[] }> {
    const phaseIds: number[] = [];

    for (const group of dto.groups) {
      if (group.registrationIds.length === 0) continue;

      // 1. Crear la fase
      const phase = this.phaseRepo.create({
        eventCategoryId: dto.eventCategoryId,
        name: group.name,
        type: PhaseType.GRUPO,
      });
      const savedPhase = await this.phaseRepo.save(phase);
      phaseIds.push(savedPhase.phaseId);

      // 2. Pool de participantes en phase_registrations
      const phaseRegs = group.registrationIds.map((registrationId) =>
        this.phaseRegistrationRepo.create({
          phaseId: savedPhase.phaseId,
          registrationId,
        }),
      );
      await this.phaseRegistrationRepo.save(phaseRegs);

      // 3. Reutilizar initializePhase — crea el match único y guarda weightClass
      await this.initializePhase(savedPhase.phaseId, group.entries);
    }

    return { created: phaseIds.length, phaseIds };
  }

  private getBestLift(attempts: WeightliftingAttempt[]): number | null {
    const valid = attempts.filter(
      (a) => a.result === 'valid' && a.weightKg !== null,
    );
    if (valid.length === 0) return null;
    return Math.max(...valid.map((a) => Number(a.weightKg)));
  }

  private getTotalAchievedAttempt(
    snatch: WeightliftingAttempt[],
    cnj: WeightliftingAttempt[],
  ): number {
    const lastValidSnatch = [...snatch].reverse().find((a) => a.result === 'valid');
    const lastValidCnj = [...cnj].reverse().find((a) => a.result === 'valid');
    const snatchGlobal = lastValidSnatch ? lastValidSnatch.attemptNumber : 99;
    const cnjGlobal = lastValidCnj ? lastValidCnj.attemptNumber + 3 : 99;
    return Math.max(snatchGlobal, cnjGlobal);
  }

  // ── Remover atleta de una fase ───────────────────────────────────────────────
  async removeAthleteFromPhase(
    phaseId: number,
    registrationId: number,
  ): Promise<{ message: string }> {
    // 1. Buscar el match único de la fase
    const match = await this.matchRepo.findOne({ where: { phaseId } });
    if (!match) throw new NotFoundException(`Phase ${phaseId} no tiene match`);

    // 2. Buscar la participation del atleta en ese match
    const participation = await this.participationRepo.findOne({
      where: { matchId: match.matchId, registrationId },
    });
    if (!participation)
      throw new NotFoundException('El atleta no está en esta fase');

    // 3. Borrar sus intentos primero (FK constraint)
    await this.attemptRepo.delete({ participationId: participation.participationId });

    // 4. Borrar la participation
    await this.participationRepo.delete({ participationId: participation.participationId });

    // 5. Borrar el phase_registration
    await this.phaseRegistrationRepo.delete({ phaseId, registrationId });

    return { message: 'Atleta removido de la fase correctamente' };
  }

  async finalizePhase(phaseId: number): Promise<{ message: string; ranksApplied: number }> {
    const results = await this.getPhaseResults(phaseId);
    if (results.length === 0) throw new NotFoundException('No hay atletas en esta fase');

    // Agrupar por weightClass para rankings independientes por división
    const groups = new Map<string, typeof results>();
    results.forEach(r => {
      const div = r.participation.registration?.weightClass ?? '__global__';
      if (!groups.has(div)) groups.set(div, []);
      groups.get(div)!.push(r);
    });

    const ranks: { registrationId: number; snatchRank: number | null; cleanAndJerkRank: number | null; totalRank: number | null }[] = [];

    groups.forEach(group => {
      // Ordenar por bestSnatch
      const bySnatch = [...group].sort((a, b) => (b.bestSnatch ?? -1) - (a.bestSnatch ?? -1));
      // Ordenar por bestCleanAndJerk
      const byCnj = [...group].sort((a, b) => (b.bestCleanAndJerk ?? -1) - (a.bestCleanAndJerk ?? -1));
      // Ordenar por total (desempate: menor totalAchievedAtAttempt)
      const byTotal = [...group].sort((a, b) => {
        const td = (b.total ?? -1) - (a.total ?? -1);
        if (td !== 0) return td;
        return (a.totalAchievedAtAttempt ?? 99) - (b.totalAchievedAtAttempt ?? 99);
      });

      group.forEach(r => {
        const regId = r.participation.registrationId ?? 0;
        ranks.push({
          registrationId: regId,
          snatchRank: bySnatch.findIndex(x => x.participation.registrationId === regId) + 1,
          cleanAndJerkRank: byCnj.findIndex(x => x.participation.registrationId === regId) + 1,
          totalRank: byTotal.findIndex(x => x.participation.registrationId === regId) + 1,
        });
      });
    });

    await this.setManualRanks(phaseId, ranks);
    return { message: 'Fase finalizada y rankings aplicados', ranksApplied: ranks.length };
  }
}
