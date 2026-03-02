import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ClimbingService, UpdateClimbingScoreDto } from './climbing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClimbingController {
  constructor(private readonly climbingService: ClimbingService) {}

  @Get('phases/:phaseId/climbing-table')
  @Public()
  getClimbingScoreTable(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.climbingService.getPhaseScores(phaseId);
  }

  @Get('phases/:phaseId/climbing-institutional')
  @Public()
  getInstitutionalRanking(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.climbingService.getInstitutionalRanking(phaseId);
  }

  @Patch('participations/:participationId/climbing-score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateClimbingScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() dto: UpdateClimbingScoreDto,
  ) {
    return this.climbingService.updateScore(participationId, dto);
  }

  @Get('participations/:participationId/climbing-score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  getParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return this.climbingService.getParticipationScore(participationId);
  }

  @Get('climbing/points-table')
  @Public()
  getPointsTable() {
    return this.climbingService.getPointsTable();
  }
}
