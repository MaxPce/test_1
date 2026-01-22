import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { JudoService } from './judo.service';
import { UpdateJudoScoreDto } from './dto/update-judo-score.dto';

@Controller('competitions/judo')
export class JudoController {
  constructor(private readonly judoService: JudoService) {}

  // PATCH /competitions/judo/matches/:matchId/score
  @Patch('matches/:matchId/score')
  async updateMatchScore(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() updateDto: UpdateJudoScoreDto,
  ) {
    console.log('🥋 Actualizando score de Judo:', {
      matchId,
      participant1Score: updateDto.participant1Score,
      participant2Score: updateDto.participant2Score,
    });

    return await this.judoService.updateMatchScore(matchId, updateDto);
  }

  // GET /competitions/judo/phases/:phaseId/bracket
  @Get('phases/:phaseId/bracket')
  async getBracketWithScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.judoService.getBracketWithScores(phaseId);
  }

  // GET /competitions/judo/matches/:matchId
  @Get('matches/:matchId')
  async getMatchDetails(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.judoService.getMatchDetails(matchId);
  }
}
