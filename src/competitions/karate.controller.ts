import { Controller, Get, Patch, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { KarateService } from './karate.service';
import { UpdateKarateScoreDto } from './dto/update-karate-score.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions/karate')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KarateController {
  constructor(private readonly karateService: KarateService) {}

  @Patch('matches/:matchId/score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateMatchScore(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() updateDto: UpdateKarateScoreDto,
  ) {
    return await this.karateService.updateMatchScore(matchId, updateDto);
  }

  @Get('phases/:phaseId/bracket')
  @Public()
  async getBracketWithScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.karateService.getBracketWithScores(phaseId);
  }

  @Get('matches/:matchId')
  @Public()
  async getMatchDetails(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.karateService.getMatchDetails(matchId);
  }
}