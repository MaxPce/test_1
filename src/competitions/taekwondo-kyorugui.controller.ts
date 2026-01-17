// src/competitions/taekwondo-kyorugui.controller.ts

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { TaekwondoKyoruguiService } from './taekwondo-kyorugui.service';
import { UpdateKyoruguiScoreDto } from './dto/update-kyorugui-score.dto';

@Controller('competitions/taekwondo/kyorugui')
export class TaekwondoKyoruguiController {
  constructor(private readonly kyoruguiService: TaekwondoKyoruguiService) {}

  // PATCH /competitions/taekwondo/kyorugui/matches/:matchId/score
  @Patch('matches/:matchId/score')
  async updateMatchScore(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() updateDto: UpdateKyoruguiScoreDto,
  ) {
    console.log('🥋 Actualizando score de Kyorugui:', {
      matchId,
      participant1Score: updateDto.participant1Score,
      participant2Score: updateDto.participant2Score,
    });

    return await this.kyoruguiService.updateMatchScore(matchId, updateDto);
  }

  // GET /competitions/taekwondo/kyorugui/phases/:phaseId/bracket
  @Get('phases/:phaseId/bracket')
  async getBracketWithScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.kyoruguiService.getBracketWithScores(phaseId);
  }

  // GET /competitions/taekwondo/kyorugui/matches/:matchId
  @Get('matches/:matchId')
  async getMatchDetails(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.kyoruguiService.getMatchDetails(matchId);
  }
}
