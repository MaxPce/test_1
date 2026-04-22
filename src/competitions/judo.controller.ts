// src/competitions/judo.controller.ts
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
import { JudoService } from './judo.service';
import { UpdateJudoScoreDto } from './dto/update-judo-score.dto';
import { GenerateKumitePhasesDto } from './dto/generate-kumite-phases.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions/judo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JudoController {
  constructor(private readonly judoService: JudoService) {}


  @Post('generate-phases')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async generatePhases(@Body() dto: GenerateKumitePhasesDto) {
    return await this.judoService.generatePhases(dto);
  }


  @Patch('matches/:matchId/score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateMatchScore(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() updateDto: UpdateJudoScoreDto,
  ) {
    return await this.judoService.updateMatchScore(matchId, updateDto);
  }

  @Get('phases/:phaseId/bracket')
  @Public()
  async getBracketWithScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.judoService.getBracketWithScores(phaseId);
  }

  @Get('matches/:matchId')
  @Public()
  async getMatchDetails(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.judoService.getMatchDetails(matchId);
  }
}