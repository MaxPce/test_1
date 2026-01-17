import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import { Participation } from './entities/participation.entity';
import { MatchStatus } from '../common/enums';
import { UpdateKyoruguiScoreDto } from './dto/update-kyorugui-score.dto';

@Injectable()
export class TaekwondoKyoruguiService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,
  ) {}

  async updateMatchScore(
    matchId: number,
    updateDto: UpdateKyoruguiScoreDto,
  ): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: ['participations', 'participations.registration'],
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    // Actualizar puntajes
    match.participant1Score = updateDto.participant1Score;
    match.participant2Score = updateDto.participant2Score;

    // Determinar ganador automáticamente
    if (updateDto.participant1Score > updateDto.participant2Score) {
      const regId = match.participations[0]?.registrationId;
      match.winnerRegistrationId = regId !== null ? regId : undefined;
    } else if (updateDto.participant2Score > updateDto.participant1Score) {
      const regId = match.participations[1]?.registrationId;
      match.winnerRegistrationId = regId !== null ? regId : undefined;
    }

    // Permitir override manual del ganador si se especifica
    if (updateDto.winnerRegistrationId) {
      match.winnerRegistrationId = updateDto.winnerRegistrationId;
    }

    // Actualizar estado a completado si hay ganador
    if (match.winnerRegistrationId) {
      match.status = MatchStatus.FINALIZADO;
    }

    return await this.matchRepository.save(match);
  }

  async getBracketWithScores(phaseId: number): Promise<Match[]> {
    return await this.matchRepository.find({
      where: { phaseId },
      relations: ['participations', 'participations.registration', 'winner'],
      order: { matchNumber: 'ASC' },
    });
  }

  async getMatchDetails(matchId: number): Promise<Match> {
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

    return match;
  }
}
