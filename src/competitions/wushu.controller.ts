import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { WushuService } from './wushu.service';
import { UpdateWushuScoreDto } from './dto/update-wushu-score.dto';

@Controller('competitions/wushu')
export class WushuController {
  constructor(private readonly wushuService: WushuService) {}

  // PATCH /competitions/wushu/matches/:matchId/score
  @Patch('matches/:matchId/score')
  async updateMatchScore(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() updateDto: UpdateWushuScoreDto,
  ) {
    return await this.wushuService.updateMatchScore(matchId, updateDto);
  }

  // GET /competitions/wushu/phases/:phaseId/bracket
  @Get('phases/:phaseId/bracket')
  async getBracketWithScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.wushuService.getBracketWithScores(phaseId);
  }

  // GET /competitions/wushu/matches/:matchId
  @Get('matches/:matchId')
  async getMatchDetails(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.wushuService.getMatchDetails(matchId);
  }
}
