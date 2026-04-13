import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TaekwondoKyoruguiService } from './taekwondo-kyorugui.service';
import {
  UpdateKyoruguiRoundsDto,
  UpdateSingleRoundDto,
} from './dto/update-kyorugui-round.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions/taekwondo/kyorugui')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaekwondoKyoruguiController {
  constructor(private readonly kyoruguiService: TaekwondoKyoruguiService) {}

  // ========== ROUNDS ==========

  /**
   * POST /competitions/taekwondo/kyorugui/matches/:matchId/rounds/single
   */
  @Post('matches/:matchId/rounds/single')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateSingleRound(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: UpdateSingleRoundDto,
  ) {
    return await this.kyoruguiService.updateSingleRound(matchId, dto);
  }

  /**
   * POST /competitions/taekwondo/kyorugui/matches/:matchId/rounds
   */
  @Post('matches/:matchId/rounds')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async updateRounds(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: UpdateKyoruguiRoundsDto,
  ) {
    return await this.kyoruguiService.updateRounds(matchId, dto);
  }

  /**
   * GET /competitions/taekwondo/kyorugui/matches/:matchId/rounds
   */
  @Get('matches/:matchId/rounds')
  @Public()
  async getMatchRounds(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.kyoruguiService.getMatchRounds(matchId);
  }

  /**
   * DELETE /competitions/taekwondo/kyorugui/matches/:matchId/rounds/:roundNumber
   */
  @Delete('matches/:matchId/rounds/:roundNumber')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async deleteRound(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
  ) {
    await this.kyoruguiService.deleteRound(matchId, roundNumber);
    return { message: `Round ${roundNumber} eliminado exitosamente` };
  }

  // ========== ENDPOINTS EXISTENTES ==========

  /**
   * GET /competitions/taekwondo/kyorugui/phases/:phaseId/bracket
   */
  @Get('phases/:phaseId/bracket')
  @Public()
  async getBracketWithScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.kyoruguiService.getBracketWithScores(phaseId);
  }

  /**
   * GET /competitions/taekwondo/kyorugui/matches/:matchId
   */
  @Get('matches/:matchId')
  @Public()
  async getMatchDetails(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.kyoruguiService.getMatchDetails(matchId);
  }
}