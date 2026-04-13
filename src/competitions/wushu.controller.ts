import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { WushuService } from './wushu.service';
import { UpdateWushuScoreDto } from './dto/update-wushu-score.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions/wushu')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WushuController {
  constructor(private readonly wushuService: WushuService) {}

  // PATCH /competitions/wushu/matches/:matchId/score
  @Patch('matches/:matchId/score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateMatchScore(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() updateDto: UpdateWushuScoreDto,
  ) {
    return await this.wushuService.updateMatchScore(matchId, updateDto);
  }

  // GET /competitions/wushu/phases/:phaseId/bracket
  @Get('phases/:phaseId/bracket')
  @Public()
  async getBracketWithScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.wushuService.getBracketWithScores(phaseId);
  }

  // GET /competitions/wushu/matches/:matchId
  @Get('matches/:matchId')
  @Public()
  async getMatchDetails(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.wushuService.getMatchDetails(matchId);
  }
}