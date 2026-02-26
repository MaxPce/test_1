import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ShootingService } from './shooting.service';
import { UpdateShootingScoreDto } from './dto/update-shooting-score.dto';

@Controller('competitions/shooting')
export class ShootingController {
  constructor(private readonly shootingService: ShootingService) {}

  // GET /competitions/shooting/phases/:phaseId/scores
  @Get('phases/:phaseId/scores')
  async getPhaseScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.shootingService.getPhaseScores(phaseId);
  }

  // PATCH /competitions/shooting/participations/:participationId/score
  @Patch('participations/:participationId/score')
  async updateScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdateShootingScoreDto,
  ) {
    return this.shootingService.updateShootingScore(participationId, updateDto);
  }

  // PATCH /competitions/shooting/participations/:participationId/dns
  @Patch('participations/:participationId/dns')
  async setDns(@Param('participationId', ParseIntPipe) participationId: number) {
    return this.shootingService.setDns(participationId);
  }

  // GET /competitions/shooting/participations/:participationId/score
  @Get('participations/:participationId/score')
  async getParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return this.shootingService.getParticipationScore(participationId);
  }
}
