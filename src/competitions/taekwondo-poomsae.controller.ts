import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TaekwondoPoomsaeService } from './taekwondo-poomsae.service';
import { UpdatePoomsaeScoreDto } from './dto/update-poomsae-score.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions/taekwondo/poomsae')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaekwondoPoomsaeController {
  constructor(private readonly poomsaeService: TaekwondoPoomsaeService) {}

  // ==================== ENDPOINTS MODO GRUPOS ====================

  @Get('phases/:phaseId/scores')
  @Public()
  async getPhaseScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.poomsaeService.getPhaseScores(phaseId);
  }

  @Patch('participations/:participationId/score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdatePoomsaeScoreDto,
  ) {
    return await this.poomsaeService.updatePoomsaeScore(participationId, updateDto);
  }

  @Get('participations/:participationId/score')
  @Public()
  async getParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return await this.poomsaeService.getParticipationScore(participationId);
  }

  // ==================== ENDPOINTS MODO BRACKET ====================

  @Patch('bracket/participations/:participationId/score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateBracketScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdatePoomsaeScoreDto,
  ) {
    return await this.poomsaeService.updatePoomsaeBracketScore(participationId, updateDto);
  }

  @Get('bracket/matches/:matchId/scores')
  @Public()
  async getBracketMatchScores(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.poomsaeService.getBracketMatchScores(matchId);
  }

  @Post('phases/:phaseId/initialize-group')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async initializeGroupPhase(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() body: { registrationIds: number[] },
  ) {
    return await this.poomsaeService.initializeGroupPhase(phaseId, body.registrationIds);
  }
}