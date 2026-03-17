import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndividualScore } from './entities/individual-score.entity';
import { Participation } from './entities/participation.entity';
import { Phase } from './entities/phase.entity';
import { Match } from './entities/match.entity';
import { PhaseRegistration } from './entities/phase-registration.entity';
import { UpdateClimbingScoreDto } from './dto/update-climbing-score.dto';
import { MatchStatus } from '../common/enums';

@Injectable()
export class ClimbingService {
  constructor(
    @InjectRepository(IndividualScore)
    private readonly individualScoreRepository: Repository<IndividualScore>,
    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,
    @InjectRepository(Phase)
    private readonly phaseRepository: Repository<Phase>,
    
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(PhaseRegistration)
    private readonly phaseRegistrationRepository: Repository<PhaseRegistration>,
    
  ) {}

  async getPhaseScores(phaseId: number) {
    const phase = await this.phaseRepository.findOne({
      where: { phaseId },
      relations: [
        'matches',
        'matches.participations',
        'matches.participations.registration',
        'matches.participations.registration.athlete',
        'matches.participations.registration.athlete.institution',
        'matches.participations.registration.team',
        'matches.participations.registration.team.institution',
      ],
    });

    if (!phase) throw new NotFoundException(`Phase ${phaseId} no encontrada`);

    const participations = phase.matches
      .flatMap((m) => m.participations || [])
      .filter((p) => {
        if (!p.registration) return false;
        if (p.registration.deletedAt) return false;
        if (p.registration.athlete?.deletedAt) return false;
        if (p.registration.team?.deletedAt) return false;
        return true;
      });

    if (participations.length === 0) return [];

    const scores = await this.individualScoreRepository.find({
      where: participations.map((p) => ({
        participationId: p.participationId,
      })),
    });

    return participations.map((p, index) => {
      const score = scores.find((s) => s.participationId === p.participationId);
      const isTeam = !!p.registration?.team;
      const athlete = p.registration?.athlete;
      const team = p.registration?.team;
      const institution = athlete?.institution ?? team?.institution;

      return {
        rowNumber: index + 1,
        participationId: p.participationId,
        registrationId: p.registrationId,
        participantName: isTeam
          ? (team?.name ?? 'Equipo')
          : (athlete?.name ?? 'Atleta'),
        participantPhoto: athlete?.photoUrl ?? null,
        institution: institution?.name ?? null,
        institutionAbrev: institution?.abrev ?? null,
        isTeam,
        total: score?.total ?? null,
        rank: score?.rank ?? null,
      };
    });
  }

  async updateScore(participationId: number, dto: UpdateClimbingScoreDto) {
    const participation = await this.participationRepository.findOne({
      where: { participationId },
    });

    if (!participation) {
      throw new NotFoundException('Participación no encontrada');
    }

    let score = await this.individualScoreRepository.findOne({
      where: { participationId },
    });

    if (!score) {
      score = this.individualScoreRepository.create({ participationId });
    }

    if (dto.total !== undefined) (score as any).total = dto.total;
    if (dto.rank  !== undefined) (score as any).rank  = dto.rank;

    await this.individualScoreRepository.save(score);

    if (participation.matchId !== null) {
      await this.recalculateRanks(participation.matchId);
    }

    return this.individualScoreRepository.findOne({ where: { participationId } });
  }


  // ─────────────────────────────────────────────────────────
  // Recalcula ranks cuando todos tienen total
  // ─────────────────────────────────────────────────────────
  private async recalculateRanks(matchId: number) {
    // 1. Todas las participations del match
    const participations = await this.participationRepository.find({
      where: { matchId },
    });

    if (participations.length === 0) return;

    // 2. Scores actuales
    const scores = await this.individualScoreRepository.find({
      where: participations.map((p) => ({ participationId: p.participationId })),
    });

    // 3. Solo rankear si TODOS tienen total (ninguno null/undefined)
    const allHaveScore = participations.every((p) => {
      const score = scores.find((s) => s.participationId === p.participationId);
      return score?.total !== null && score?.total !== undefined;
    });

    if (!allHaveScore) return;

    // 4. Ordenar por total DESC (mayor puntaje = mejor posición)
    const sorted = [...scores].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

    // 5. Asignar rank — manejar empates (mismo total = mismo rank)
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].total === sorted[i - 1].total) {
        // Empate: mismo rank que el anterior
        (sorted[i] as any).rank = (sorted[i - 1] as any).rank;
      } else {
        (sorted[i] as any).rank = currentRank;
      }
      currentRank++;
    }

    // 6. Guardar todos los ranks actualizados
    await this.individualScoreRepository.save(sorted);
  }




  /**
   * Asigna un atleta a la fase de escalada.
   * 1. Crea PhaseRegistration (idempotente)
   * 2. Busca o crea el match grupal único de la fase
   * 3. Crea Participation en ese match (idempotente)
   */
  async assignParticipant(phaseId: number, registrationId: number) {
    // 1. PhaseRegistration
    const existingPR = await this.phaseRegistrationRepository.findOne({
      where: { phaseId, registrationId },
    });
    if (!existingPR) {
      await this.phaseRegistrationRepository.save(
        this.phaseRegistrationRepository.create({ phaseId, registrationId }),
      );
    }

    // 2. Match grupal único — buscarlo o crearlo
    let match = await this.matchRepository.findOne({
      where: { phaseId },
    });
    if (!match) {
      match = await this.matchRepository.save(
        this.matchRepository.create({
          phaseId,
          matchNumber: 1,
          round: 'Final',
          status: MatchStatus.EN_CURSO,
        }),
      );
    }

    // 3. Participation
    const existingP = await this.participationRepository.findOne({
      where: { matchId: match.matchId, registrationId },
    });
    if (!existingP) {
      await this.participationRepository.save(
        this.participationRepository.create({
          matchId: match.matchId,
          registrationId,
        }),
      );
    }

    return { ok: true, phaseId, registrationId, matchId: match.matchId };
  }

  /**
   * Quita un atleta de la fase de escalada.
   * Elimina PhaseRegistration y Participation del match grupal.
   */
  async removeParticipant(phaseId: number, registrationId: number) {
    // 1. Quitar PhaseRegistration
    const pr = await this.phaseRegistrationRepository.findOne({
      where: { phaseId, registrationId },
    });
    if (pr) await this.phaseRegistrationRepository.remove(pr);

    // 2. Quitar Participation del match grupal
    const match = await this.matchRepository.findOne({ where: { phaseId } });
    if (match) {
      const p = await this.participationRepository.findOne({
        where: { matchId: match.matchId, registrationId },
      });
      if (p) await this.participationRepository.remove(p);
    }

    return { ok: true };
  }
}
