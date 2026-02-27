import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeightliftingAttempt } from './entities/weightlifting-attempt.entity';
import { Participation } from './entities/participation.entity';
import { UpsertWeightliftingAttemptDto } from './dto/create-weightlifting-attempt.dto';

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
  ) {}

  async getPhaseResults(
    phaseId: number,
  ): Promise<WeightliftingAthleteResult[]> {
    const participations = await this.participationRepo
      .createQueryBuilder('p')
      .innerJoin('p.match', 'match')
      .leftJoinAndSelect('p.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'institution')
      .where('match.phase_id = :phaseId', { phaseId })
      .getMany();

    // Si no hay matches aún (fase recién creada sin partidos),
    // caemos al fallback de phase_registrations
    const finalParticipations =
      participations.length > 0
        ? participations
        : await this.getParticipationsFromPhaseRegistrations(phaseId);

    if (finalParticipations.length === 0) return [];

    const participationIds = finalParticipations.map((p) => p.participationId);

    const allAttempts = await this.attemptRepo
      .createQueryBuilder('a')
      .where('a.participation_id IN (:...ids)', { ids: participationIds })
      .orderBy('a.attempt_number', 'ASC')
      .getMany();

    const results: WeightliftingAthleteResult[] = finalParticipations.map(
      (p) => {
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
      },
    );

    const ranked = results.sort((a, b) => {
      if (a.total === null && b.total === null) return 0;
      if (a.total === null) return 1;
      if (b.total === null) return -1;
      if (b.total !== a.total) return b.total - a.total;
      return (
        (a.totalAchievedAtAttempt ?? 99) - (b.totalAchievedAtAttempt ?? 99)
      );
    });

    ranked.forEach((r, idx) => {
      r.rank = r.total !== null ? idx + 1 : null;
    });

    return ranked;
  }

  /**
   * Fallback: obtiene participations via phase_registrations.
   * Usamos participationId = registrationId como proxy para identificar
   * al atleta dentro del contexto de la fase cuando no hay matches.
   * Los intentos se guardan por participationId que viene del frontend
   * (el WeightliftingAttemptsTable envía el registrationId como participationId).
   */
  private async getParticipationsFromPhaseRegistrations(
    phaseId: number,
  ): Promise<Participation[]> {
    return this.participationRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'institution')
      .innerJoin(
        'phase_registrations',
        'pr',
        'pr.registration_id = p.registration_id AND pr.phase_id = :phaseId',
        { phaseId },
      )
      .where('p.match_id IS NULL')
      .getMany();
  }

  async getParticipationAttempts(
    participationId: number,
  ): Promise<WeightliftingAttempt[]> {
    return this.attemptRepo.find({
      where: { participationId },
      order: { liftType: 'ASC', attemptNumber: 'ASC' },
    });
  }

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

  private getBestLift(attempts: WeightliftingAttempt[]): number | null {
    const validAttempts = attempts.filter(
      (a) => a.result === 'valid' && a.weightKg !== null,
    );
    if (validAttempts.length === 0) return null;
    return Math.max(...validAttempts.map((a) => Number(a.weightKg)));
  }

  private getTotalAchievedAttempt(
    snatch: WeightliftingAttempt[],
    cnj: WeightliftingAttempt[],
  ): number {
    const lastValidSnatch = [...snatch]
      .reverse()
      .find((a) => a.result === 'valid');
    const lastValidCnj = [...cnj].reverse().find((a) => a.result === 'valid');
    const snatchGlobal = lastValidSnatch ? lastValidSnatch.attemptNumber : 99;
    const cnjGlobal = lastValidCnj ? lastValidCnj.attemptNumber + 3 : 99;
    return Math.max(snatchGlobal, cnjGlobal);
  }
}
