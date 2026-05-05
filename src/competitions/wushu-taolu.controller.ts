import {
  Controller,
  Get,
  Post, 
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { WushuTaoluService } from './wushu-taolu.service';
import { UpdateTaoluScoreDto } from './dto/update-taolu-score.dto';
import { UpdateTaoluBracketScoreDto } from './dto/update-taolu-bracket-score.dto'; // ← AÑADIDO
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions/wushu/taolu')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WushuTaoluController {
  constructor(private readonly taoluService: WushuTaoluService) {}

  // ==================== ENDPOINTS MODO GRUPOS ====================

  @Post('phases/:phaseId/initialize-group')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async initializeGroupPhase(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() body: { registrationIds: number[] },
  ) {
    return await this.taoluService.initializeGroupPhase(phaseId, body.registrationIds);
  }

  @Post('generate-phases')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async generateTaoluPhases(
    @Body() body: {
      eventCategoryId: number;
      groups: { name: string; registrationIds: number[] }[];
    },
  ) {
    return await this.taoluService.generateTaoluPhases(body);
  }

  @Get('phases/:phaseId/scores')
  @Public()
  async getPhaseScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.taoluService.getPhaseScores(phaseId);
  }

  // ← CORREGIDO: UpdateTaoluScoreDto (jueces B/A)
  @Patch('participations/:participationId/score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdateTaoluScoreDto,
  ) {
    return await this.taoluService.updatePoomsaeScore(participationId, updateDto);
  }

  @Get('participations/:participationId/score')
  @Public()
  async getParticipationScore(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return await this.taoluService.getParticipationScore(participationId);
  }

  // ==================== ENDPOINTS MODO BRACKET ====================

  // ← CORREGIDO: UpdateTaoluBracketScoreDto (accuracy/presentation)
  @Patch('bracket/participations/:participationId/score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateBracketScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdateTaoluBracketScoreDto,
  ) {
    return await this.taoluService.updatePoomsaeBracketScore(participationId, updateDto);
  }

  @Get('bracket/matches/:matchId/scores')
  @Public()
  async getBracketMatchScores(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.taoluService.getBracketMatchScores(matchId);
  }
}