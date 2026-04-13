import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ShootingService } from './shooting.service';
import { UpdateShootingScoreDto } from './dto/update-shooting-score.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions/shooting')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShootingController {
  constructor(private readonly shootingService: ShootingService) {}

  // GET /competitions/shooting/phases/:phaseId/scores
  @Get('phases/:phaseId/scores')
  @Public()
  async getPhaseScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.shootingService.getPhaseScores(phaseId);
  }

  // PATCH /competitions/shooting/participations/:participationId/score
  @Patch('participations/:participationId/score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdateShootingScoreDto,
  ) {
    return this.shootingService.updateShootingScore(participationId, updateDto);
  }

  // PATCH /competitions/shooting/participations/:participationId/dns
  @Patch('participations/:participationId/dns')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async setDns(@Param('participationId', ParseIntPipe) participationId: number) {
    return this.shootingService.setDns(participationId);
  }

  // GET /competitions/shooting/participations/:participationId/score
  @Get('participations/:participationId/score')
  @Public()
  async getParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return this.shootingService.getParticipationScore(participationId);
  }

  @Post('phases/:phaseId/initialize-group')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async initializeGroupPhase(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() body: { registrationIds: number[] },
  ) {
    return this.shootingService.initializeGroupPhase(phaseId, body.registrationIds);
  }
}