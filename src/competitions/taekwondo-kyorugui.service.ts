import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import { Participation } from './entities/participation.entity';
import { MatchGame, GameStatus } from './entities/match-game.entity';
import { MatchStatus } from '../common/enums';
import { BracketService } from './bracket.service';
import { 
  UpdateKyoruguiRoundsDto, 
  UpdateSingleRoundDto,
  KyoruguiRoundDto 
} from './dto/update-kyorugui-round.dto';

@Injectable()
export class TaekwondoKyoruguiService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,
    @InjectRepository(MatchGame)
    private readonly roundRepository: Repository<MatchGame>,
    private readonly bracketService: BracketService, 
  ) {}


  /**
   * Actualizar un solo round (para edición individual)
   */
  async updateSingleRound(
    matchId: number,
    dto: UpdateSingleRoundDto,
  ): Promise<MatchGame> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: ['participations', 'participations.registration'],
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    if (match.participations.length < 2) {
      throw new BadRequestException('El match debe tener 2 participantes');
    }

    // ✅ CORRECCIÓN: Validar que registrationId no sea null
    const participant1RegId = match.participations[0].registrationId;
    const participant2RegId = match.participations[1].registrationId;

    if (!participant1RegId || !participant2RegId) {
      throw new BadRequestException('Los participantes no tienen registrationId válido');
    }

    // Buscar o crear el round
    let round = await this.roundRepository.findOne({
      where: { matchId, gameNumber: dto.roundNumber },
    });

    // Determinar ganador del round
    let roundWinnerId: number | null = null;
    if (dto.participant1Points > dto.participant2Points) {
      roundWinnerId = participant1RegId;
    } else if (dto.participant2Points > dto.participant1Points) {
      roundWinnerId = participant2RegId;
    }

    if (!round) {
      round = new MatchGame();
      round.matchId = matchId;
      round.gameNumber = dto.roundNumber;
      round.player1Id = participant1RegId;
      round.player2Id = participant2RegId;
      round.score1 = dto.participant1Points;
      round.score2 = dto.participant2Points;
      round.winnerId = roundWinnerId;
      round.status = GameStatus.COMPLETED;
      round.startedAt = new Date();
      round.completedAt = new Date();
      round.sets = null;
    } else {
      // Actualizar round existente
      round.score1 = dto.participant1Points;
      round.score2 = dto.participant2Points;
      round.winnerId = roundWinnerId;
      round.status = GameStatus.COMPLETED;
      round.completedAt = new Date();
    }

    const savedRound = await this.roundRepository.save(round);

    // Recalcular el resultado del match completo
    await this.calculateMatchWinner(matchId);

    return savedRound;
  }

  /**
 * Actualizar múltiples rounds a la vez
 */
  async updateRounds(
    matchId: number,
    dto: UpdateKyoruguiRoundsDto,
  ): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: ['participations', 'participations.registration', 'phase'], // ✅ AGREGAR 'phase'
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    if (match.participations.length < 2) {
      throw new BadRequestException('El match debe tener 2 participantes');
    }

    if (dto.rounds.length > 3) {
      throw new BadRequestException('Solo se permiten máximo 3 rounds');
    }

    // Procesar cada round
    for (const roundDto of dto.rounds) {
      await this.updateSingleRound(matchId, {
        roundNumber: roundDto.roundNumber,
        participant1Points: roundDto.participant1Points,
        participant2Points: roundDto.participant2Points,
      });
    }

    // Recalcular ganador del match
    const updatedMatch = await this.calculateMatchWinner(matchId);

    
    if (
      updatedMatch.status === MatchStatus.FINALIZADO &&
      updatedMatch.winnerRegistrationId &&
      match.phase?.type === 'eliminacion'
    ) {
      await this.bracketService.advanceWinner({
        matchId: updatedMatch.matchId,
        winnerRegistrationId: updatedMatch.winnerRegistrationId,
        participant1Score: updatedMatch.participant1Score,
        participant2Score: updatedMatch.participant2Score,
      });
    }

    return updatedMatch;
  }


  /**
   * Calcular ganador del match basándose en los rounds ganados
   */
  private async calculateMatchWinner(matchId: number): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: ['participations', 'participations.registration'],
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    // Obtener todos los rounds del match
    const rounds = await this.roundRepository.find({
      where: { matchId },
      order: { gameNumber: 'ASC' },
    });

    // Validar registrationId antes de usar
    const participant1RegId = match.participations[0]?.registrationId;
    const participant2RegId = match.participations[1]?.registrationId;

    if (!participant1RegId || !participant2RegId) {
      throw new BadRequestException('Los participantes no tienen registrationId válido');
    }

    // Contar rounds ganados
    let participant1Rounds = 0;
    let participant2Rounds = 0;

    for (const round of rounds) {
      if (round.winnerId === participant1RegId) {
        participant1Rounds++;
      } else if (round.winnerId === participant2RegId) {
        participant2Rounds++;
      }
    }

    // Actualizar scores del match (rounds ganados)
    match.participant1Score = participant1Rounds;
    match.participant2Score = participant2Rounds;

    // Asignar correctamente con tipos validados
    if (participant1Rounds >= 2) {
      match.winnerRegistrationId = participant1RegId; // Ahora es number, no number | null
      match.status = MatchStatus.FINALIZADO;
    } else if (participant2Rounds >= 2) {
      match.winnerRegistrationId = participant2RegId; // Ahora es number, no number | null
      match.status = MatchStatus.FINALIZADO;
    } else {
      // Match en curso
      match.winnerRegistrationId = undefined;
      if (rounds.length > 0) {
        match.status = MatchStatus.EN_CURSO;
      }
    }

    return await this.matchRepository.save(match);
  }

  /**
   * Obtener rounds de un match
   */
  async getMatchRounds(matchId: number): Promise<MatchGame[]> {
    return await this.roundRepository.find({
      where: { matchId },
      order: { gameNumber: 'ASC' },
    });
  }

  /**
   * Obtener bracket con scores (mantener compatibilidad)
   */
  async getBracketWithScores(phaseId: number): Promise<Match[]> {
    return await this.matchRepository.find({
      where: { phaseId },
      relations: ['participations', 'participations.registration', 'winner'],
      order: { matchNumber: 'ASC' },
    });
  }

  /**
   * Obtener detalles completos de un match incluyendo rounds
   */
  async getMatchDetails(matchId: number): Promise<any> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: [
        'participations',
        'participations.registration',
        'participations.registration.athlete',
        'winner',
      ],
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    // Obtener rounds
    const rounds = await this.getMatchRounds(matchId);

    return {
      ...match,
      rounds,
    };
  }

  /**
   * Eliminar un round específico
   */
  async deleteRound(matchId: number, roundNumber: number): Promise<void> {
    const round = await this.roundRepository.findOne({
      where: { matchId, gameNumber: roundNumber },
    });

    if (!round) {
      throw new NotFoundException(`Round ${roundNumber} no encontrado`);
    }

    await this.roundRepository.remove(round);

    // Recalcular ganador
    await this.calculateMatchWinner(matchId);
  }
}
