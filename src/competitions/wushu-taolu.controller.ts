import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { WushuTaoluService } from './wushu-taolu.service';
import { UpdateTaoluScoreDto } from './dto/update-taolu-score.dto';

@Controller('competitions/wushu/taolu')
export class WushuTaoluController {
  constructor(private readonly taoluService: WushuTaoluService) {}

  // ==================== ENDPOINTS MODO GRUPOS ====================

  // GET /competitions/taekwondo/poomsae/phases/:phaseId/scores
  @Get('phases/:phaseId/scores')
  async getPhaseScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.taoluService.getPhaseScores(phaseId);
  }

  // PATCH /competitions/taekwondo/poomsae/participations/:participationId/score
  @Patch('participations/:participationId/score')
  async updateParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdateTaoluScoreDto,
  ) {
    console.log('📊 Datos recibidos en backend (modo grupos):', updateDto);
    console.log(
      '   - accuracy:',
      updateDto.accuracy,
      '(tipo:',
      typeof updateDto.accuracy,
      ')',
    );
    console.log(
      '   - presentation:',
      updateDto.presentation,
      '(tipo:',
      typeof updateDto.presentation,
      ')',
    );

    return await this.taoluService.updatePoomsaeScore(
      participationId,
      updateDto,
    );
  }

  // GET /competitions/taekwondo/poomsae/participations/:participationId/score
  @Get('participations/:participationId/score')
  async getParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return await this.taoluService.getParticipationScore(participationId);
  }

  // ==================== ENDPOINTS MODO BRACKET (NUEVOS) ====================

  // PATCH /competitions/taekwondo/poomsae/bracket/participations/:participationId/score
  @Patch('bracket/participations/:participationId/score')
  async updateBracketScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdateTaoluScoreDto,
  ) {
    console.log('🥋 Actualizando score en modo BRACKET:', {
      participationId,
      accuracy: updateDto.accuracy,
      presentation: updateDto.presentation,
    });

    return await this.taoluService.updatePoomsaeBracketScore(
      participationId,
      updateDto,
    );
  }

  // GET /competitions/taekwondo/poomsae/bracket/matches/:matchId/scores
  @Get('bracket/matches/:matchId/scores')
  async getBracketMatchScores(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.taoluService.getBracketMatchScores(matchId);
  }
}
