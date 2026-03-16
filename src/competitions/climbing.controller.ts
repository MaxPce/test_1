import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ClimbingService } from './climbing.service';
import { UpdateClimbingScoreDto } from './dto/update-climbing-score.dto';

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

  @Patch('participations/:participationId/climbing-score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateClimbingScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() dto: UpdateClimbingScoreDto,
  ) {
    return this.climbingService.updateScore(participationId, dto);
  }

  // POST /competitions/phases/:phaseId/climbing-assign
  @Post('phases/:phaseId/climbing-assign')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  assignParticipant(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body('registrationId') registrationId: number,
  ) {
    return this.climbingService.assignParticipant(phaseId, registrationId);
  }

  // DELETE /competitions/phases/:phaseId/climbing-assign/:registrationId
  @Delete('phases/:phaseId/climbing-assign/:registrationId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  removeParticipant(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Param('registrationId', ParseIntPipe) registrationId: number,
  ) {
    return this.climbingService.removeParticipant(phaseId, registrationId);
  }
}
