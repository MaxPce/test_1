// src/competitions/taekwondo-poomsae.controller.ts

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { TaekwondoPoomsaeService } from './taekwondo-poomsae.service';
import { UpdatePoomsaeScoreDto } from './dto/update-poomsae-score.dto';

@Controller('competitions/taekwondo/poomsae')
export class TaekwondoPoomsaeController {
  constructor(private readonly poomsaeService: TaekwondoPoomsaeService) {}

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
    console.log('📊 Datos recibidos en backend:', updateDto);
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
}
