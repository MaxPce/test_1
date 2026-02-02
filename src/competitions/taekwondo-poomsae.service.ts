import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndividualScore } from './entities/individual-score.entity';
import { Participation } from './entities/participation.entity';
import { Phase } from './entities/phase.entity';
import { Match } from './entities/match.entity';
import { UpdatePoomsaeScoreDto } from './dto/update-poomsae-score.dto';
import { BracketService } from './bracket.service';
import { MatchStatus } from '../common/enums';

@Injectable()
export class TaekwondoPoomsaeService {
  constructor(
    @InjectRepository(IndividualScore)
    private readonly individualScoreRepository: Repository<IndividualScore>,
    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,
    @InjectRepository(Phase)
    private readonly phaseRepository: Repository<Phase>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    private readonly bracketService: BracketService,
  ) {}

  // ==================== MODO GRUPOS (EXISTENTE) ====================

  async updatePoomsaeScore(
    participationId: number,
    updateDto: UpdatePoomsaeScoreDto,
  ): Promise<IndividualScore> {
    const participation = await this.participationRepository.findOne({
      where: { participationId },
    });

    if (!participation) {
      throw new NotFoundException(
        `Participation ${participationId} no encontrada`,
      );
    }

    if (!participation.matchId) {
      throw new NotFoundException(
        `Participation ${participationId} no tiene match asignado`,
      );
    }

    let score = await this.individualScoreRepository.findOne({
      where: { participationId },
    });

    const total = updateDto.accuracy + updateDto.presentation;

    if (score) {
      score.accuracy = updateDto.accuracy;
      score.presentation = updateDto.presentation;
      score.total = total;
    } else {
      score = this.individualScoreRepository.create({
        participationId,
        accuracy: updateDto.accuracy,
        presentation: updateDto.presentation,
        total,
      });
    }

    await this.individualScoreRepository.save(score);
    await this.recalculateRankings(participation.matchId);

    return score;
  }

  // ==================== MODO BRACKET (NUEVO) ====================

  /**
   * Actualiza el score de un participante en modo bracket y determina automáticamente el ganador
   */
  async updatePoomsaeBracketScore(
    participationId: number,
    updateDto: UpdatePoomsaeScoreDto,
  ): Promise<{
    score: IndividualScore;
    matchFinalized: boolean;
    winner?: {
      participationId: number;
      registrationId: number;
      total: number;
    };
    advancedToNextRound: boolean;
    message: string;
  }> {
    // 1. Validar participación
    const participation = await this.participationRepository.findOne({
      where: { participationId },
      relations: ['match', 'match.participations', 'registration'],
    });

    if (!participation) {
      throw new NotFoundException(
        `Participation ${participationId} no encontrada`,
      );
    }

    if (!participation.matchId) {
      throw new NotFoundException(
        `Participation ${participationId} no tiene match asignado`,
      );
    }

    const match = participation.match;

    // 2. Validar que el match esté en estado válido para actualizar scores
    if (match.status === MatchStatus.FINALIZADO) {
      throw new BadRequestException(
        'No se puede actualizar el score de un match ya finalizado',
      );
    }

    // 3. Actualizar o crear el score del participante actual
    let score = await this.individualScoreRepository.findOne({
      where: { participationId },
    });

    const total = updateDto.accuracy + updateDto.presentation;

    if (score) {
      score.accuracy = updateDto.accuracy;
      score.presentation = updateDto.presentation;
      score.total = total;
    } else {
      score = this.individualScoreRepository.create({
        participationId,
        accuracy: updateDto.accuracy,
        presentation: updateDto.presentation,
        total,
      });
    }

    await this.individualScoreRepository.save(score);

    // 4. Verificar si ya hay 2 participantes en el match
    const participations = match.participations;

    if (participations.length !== 2) {
      // Solo hay 1 participante, no se puede determinar ganador aún
      return {
        score,
        matchFinalized: false,
        advancedToNextRound: false,
        message: 'Score actualizado. Esperando al segundo competidor.',
      };
    }

    // 5. Obtener los scores de ambos participantes
    const allScores = await this.individualScoreRepository.find({
      where: participations.map((p) => ({
        participationId: p.participationId,
      })),
    });

    // 6. Verificar si ambos competidores ya tienen scores completos
    if (allScores.length < 2) {
      return {
        score,
        matchFinalized: false,
        advancedToNextRound: false,
        message: 'Score actualizado. Esperando score del oponente.',
      };
    }

    // Verificar que ambos scores tengan totales válidos
    const validScores = allScores.filter(
      (s) => s.total !== null && s.total !== undefined && s.total > 0,
    );

    if (validScores.length < 2) {
      return {
        score,
        matchFinalized: false,
        advancedToNextRound: false,
        message: 'Score actualizado. Esperando score completo del oponente.',
      };
    }

    // 7. DETERMINAR EL GANADOR AUTOMÁTICAMENTE
    const [score1, score2] = allScores;

    let winnerScore: IndividualScore;
    let winnerParticipation: Participation | undefined;

    if (score1.total > score2.total) {
      winnerScore = score1;
      winnerParticipation = participations.find(
        (p) => p.participationId === score1.participationId,
      );
    } else if (score2.total > score1.total) {
      winnerScore = score2;
      winnerParticipation = participations.find(
        (p) => p.participationId === score2.participationId,
      );
    } else {
      // Esto no debería ocurrir según las reglas, pero por seguridad
      throw new BadRequestException(
        'Empate detectado. Esto no debería ser posible según las reglas de Poomsae.',
      );
    }

    if (!winnerParticipation) {
      throw new NotFoundException(
        'No se pudo determinar el participante ganador',
      );
    }

    if (!winnerParticipation.registrationId) {
      throw new BadRequestException(
        'El participante ganador no tiene registrationId',
      );
    }

    // 8. Actualizar el match con participant1_score y participant2_score
    const participant1 = participations[0];
    const participant2 = participations[1];

    const participant1Score = allScores.find(
      (s) => s.participationId === participant1.participationId,
    );
    const participant2Score = allScores.find(
      (s) => s.participationId === participant2.participationId,
    );

    match.participant1Score = participant1Score?.total || 0;
    match.participant2Score = participant2Score?.total || 0;

    await this.matchRepository.save(match);

    // 9. Avanzar automáticamente al ganador usando BracketService
    const advanceResult = await this.bracketService.advanceWinner({
      matchId: match.matchId,
      winnerRegistrationId: winnerParticipation.registrationId,
      participant1Score: match.participant1Score,
      participant2Score: match.participant2Score,
    });

    // 10. Retornar resultado completo
    return {
      score,
      matchFinalized: true,
      winner: {
        participationId: winnerParticipation.participationId,
        registrationId: winnerParticipation.registrationId,
        total: winnerScore.total,
      },
      advancedToNextRound: !!advanceResult.nextMatch,
      message: advanceResult.message,
    };
  }

  /**
   * Obtiene los scores de un match específico en modo bracket
   */
  async getBracketMatchScores(matchId: number): Promise<any> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: [
        'participations',
        'participations.registration',
        'participations.registration.athlete',
        'participations.registration.athlete.institution',
      ],
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    const participations = match.participations;

    if (!participations || participations.length === 0) {
      return {
        matchId,
        participants: [],
        status: match.status,
        winner: null,
      };
    }

    // Obtener scores
    const scores = await this.individualScoreRepository.find({
      where: participations.map((p) => ({
        participationId: p.participationId,
      })),
    });

    const participants = participations.map((participation) => {
      const score = scores.find(
        (s) => s.participationId === participation.participationId,
      );
      const athlete = participation.registration?.athlete;
      const institution = athlete?.institution;

      return {
        participationId: participation.participationId,
        registrationId: participation.registrationId,
        corner: participation.corner,
        athleteName: athlete?.name || 'Sin nombre',
        athletePhoto: athlete?.photoUrl || null,
        institution: institution?.name || 'Sin institución',
        institutionLogo: institution?.logoUrl || null,
        accuracy: score?.accuracy || null,
        presentation: score?.presentation || null,
        total: score?.total || null,
        isWinner: match.winnerRegistrationId === participation.registrationId,
      };
    });

    return {
      matchId,
      matchNumber: match.matchNumber,
      round: match.round,
      status: match.status,
      participants,
      winner: match.winnerRegistrationId
        ? participants.find(
            (p) => p.registrationId === match.winnerRegistrationId,
          )
        : null,
    };
  }

  // ==================== MÉTODOS COMUNES ====================

  async getPhaseScores(phaseId: number) {
    const phase = await this.phaseRepository.findOne({
      where: { phaseId },
      relations: [
        'matches',
        'matches.participations',
        'matches.participations.registration',
        'matches.participations.registration.athlete',
        'matches.participations.registration.athlete.institution',
      ],
    });

    if (!phase) {
      throw new NotFoundException(`Phase ${phaseId} no encontrada`);
    }

    // Obtener participaciones
    const participations = phase.matches
      .flatMap((match) => match.participations || [])
      .filter((p) => p !== null);

    if (participations.length === 0) {
      return []; // No hay participantes
    }

    const scores = await this.individualScoreRepository.find({
      where: participations.map((p) => ({
        participationId: p.participationId,
      })),
    });

    const results = participations.map((participation) => {
      const score = scores.find(
        (s) => s.participationId === participation.participationId,
      );
      const athlete = participation.registration?.athlete;
      const institution = athlete?.institution;

      return {
        participationId: participation.participationId,
        athleteName: athlete?.name || 'Sin nombre',
        athletePhoto: athlete?.photoUrl || null,
        institution: institution?.name || 'Sin institución',
        institutionLogo: institution?.logoUrl || null,
        gender: athlete?.gender || '-',
        accuracy: score?.accuracy || null,
        presentation: score?.presentation || null,
        total: score?.total || null,
        rank: score?.rank || null,
      };
    });

    return results;
  }

  async getParticipationScore(
    participationId: number,
  ): Promise<IndividualScore> {
    const score = await this.individualScoreRepository.findOne({
      where: { participationId },
    });

    if (!score) {
      throw new NotFoundException(
        `Score para participación ${participationId} no encontrado`,
      );
    }

    return score;
  }

  private async recalculateRankings(matchId: number): Promise<void> {
    const participation = await this.participationRepository.findOne({
      where: { matchId },
      relations: ['match'],
    });

    if (!participation || !participation.match) return;

    const phaseId = participation.match.phaseId;

    const participationsWithScores = await this.participationRepository.find({
      where: { match: { phaseId } },
      relations: ['match'],
    });

    const participationIds = participationsWithScores.map(
      (p) => p.participationId,
    );

    const scores = await this.individualScoreRepository.find({
      where: participationIds.map((id) => ({ participationId: id })),
    });

    const sorted = scores
      .filter((score) => score.total && score.total > 0)
      .sort((a, b) => b.total - a.total);

    for (let i = 0; i < sorted.length; i++) {
      await this.individualScoreRepository.update(sorted[i].scoreId, {
        rank: i + 1,
      });
    }
  }
}
