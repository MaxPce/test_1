import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { TaekwondoPoomsaeService } from './taekwondo-poomsae.service';
import { UpdatePoomsaeScoreDto } from './dto/update-poomsae-score.dto';

@Controller('competitions/taekwondo/poomsae')
export class TaekwondoPoomsaeController {
  constructor(private readonly poomsaeService: TaekwondoPoomsaeService) {}

  // ==================== ENDPOINTS MODO GRUPOS ====================

  // GET /competitions/taekwondo/poomsae/phases/:phaseId/scores
  @Get('phases/:phaseId/scores')
  async getPhaseScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.poomsaeService.getPhaseScores(phaseId);
  }

  // PATCH /competitions/taekwondo/poomsae/participations/:participationId/score
  @Patch('participations/:participationId/score')
  async updateParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdatePoomsaeScoreDto,
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

    return await this.poomsaeService.updatePoomsaeScore(
      participationId,
      updateDto,
    );
  }

  // GET /competitions/taekwondo/poomsae/participations/:participationId/score
  @Get('participations/:participationId/score')
  async getParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return await this.poomsaeService.getParticipationScore(participationId);
  }

  // ==================== ENDPOINTS MODO BRACKET (NUEVOS) ====================

  // PATCH /competitions/taekwondo/poomsae/bracket/participations/:participationId/score
  @Patch('bracket/participations/:participationId/score')
  async updateBracketScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdatePoomsaeScoreDto,
  ) {
    console.log('🥋 Actualizando score en modo BRACKET:', {
      participationId,
      accuracy: updateDto.accuracy,
      presentation: updateDto.presentation,
    });

    return await this.poomsaeService.updatePoomsaeBracketScore(
      participationId,
      updateDto,
    );
  }

  // GET /competitions/taekwondo/poomsae/bracket/matches/:matchId/scores
  @Get('bracket/matches/:matchId/scores')
  async getBracketMatchScores(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.poomsaeService.getBracketMatchScores(matchId);
  }

  // POST /competitions/taekwondo/poomsae/phases/:phaseId/initialize-group
  @Post('phases/:phaseId/initialize-group')
  async initializeGroupPhase(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() body: { registrationIds: number[] },
  ) {
    return await this.poomsaeService.initializeGroupPhase(phaseId, body.registrationIds);
  }
}

