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
  ) {}

  // ── Resultados de la fase ────────────────────────────────────────────────
  async getPhaseResults(phaseId: number): Promise<WeightliftingAthleteResult[]> {
    const participations = await this.participationRepo
      .createQueryBuilder('p')
      .innerJoin('p.match', 'match')
      .leftJoinAndSelect('p.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'institution')
      .where('match.phase_id = :phaseId', { phaseId })
      .getMany();

    if (participations.length === 0) return [];

    const participationIds = participations.map((p) => p.participationId);

    const allAttempts = await this.attemptRepo
      .createQueryBuilder('a')
      .where('a.participation_id IN (:...ids)', { ids: participationIds })
      .orderBy('a.attempt_number', 'ASC')
      .getMany();

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

    attempt.liftType = dto.liftType;
    attempt.attemptNumber = dto.attemptNumber;
    attempt.weightKg = dto.weightKg ?? null;
    attempt.result = dto.result;

    return this.attemptRepo.save(attempt);
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
}
