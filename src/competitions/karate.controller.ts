import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { KarateService } from './karate.service';
import { UpdateKarateScoreDto } from './dto/update-karate-score.dto';

@Controller('competitions/karate')
export class KarateController {
  constructor(private readonly karateService: KarateService) {}

  // PATCH /competitions/karate/matches/:matchId/score
  @Patch('matches/:matchId/score')
  async updateMatchScore(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() updateDto: UpdateKarateScoreDto,
  ) {
    
    return await this.karateService.updateMatchScore(matchId, updateDto);
  }

  // GET /competitions/karate/phases/:phaseId/bracket
  @Get('phases/:phaseId/bracket')
  async getBracketWithScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.karateService.getBracketWithScores(phaseId);
  }

  // GET /competitions/karate/matches/:matchId
  @Get('matches/:matchId')
  async getMatchDetails(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.karateService.getMatchDetails(matchId);
  }
}
