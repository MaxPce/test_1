import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import { Participation } from './entities/participation.entity';
import { MatchStatus } from '../common/enums';
import { UpdateWushuScoreDto } from './dto/update-wushu-score.dto';

@Injectable()
export class WushuService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,
  ) {}

  async updateMatchScore(
    matchId: number,
    updateDto: UpdateWushuScoreDto,
  ): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: ['participations', 'participations.registration'],
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    match.participant1Score = updateDto.participant1Score;
    match.participant2Score = updateDto.participant2Score;

    if (updateDto.participant1Score > updateDto.participant2Score) {
      const regId = match.participations[0]?.registrationId;
      match.winnerRegistrationId = regId !== null ? regId : undefined;
    } else if (updateDto.participant2Score > updateDto.participant1Score) {
      const regId = match.participations[1]?.registrationId;
      match.winnerRegistrationId = regId !== null ? regId : undefined;
    }

    if (updateDto.winnerRegistrationId) {
      match.winnerRegistrationId = updateDto.winnerRegistrationId;
    }

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
