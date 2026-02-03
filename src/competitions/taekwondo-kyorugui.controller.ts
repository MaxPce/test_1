import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { TaekwondoKyoruguiService } from './taekwondo-kyorugui.service';
import { 
  UpdateKyoruguiRoundsDto, 
  UpdateSingleRoundDto 
} from './dto/update-kyorugui-round.dto';

@Controller('competitions/taekwondo/kyorugui')
export class TaekwondoKyoruguiController {
  constructor(private readonly kyoruguiService: TaekwondoKyoruguiService) {}

  // ========== NUEVOS ENDPOINTS PARA ROUNDS ==========

  /**
   * POST /competitions/taekwondo/kyorugui/matches/:matchId/rounds/single
   * Actualizar un solo round
   */
  @Post('matches/:matchId/rounds/single')
  async updateSingleRound(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: UpdateSingleRoundDto,
  ) {

    return await this.kyoruguiService.updateSingleRound(matchId, dto);
  }

  /**
   * POST /competitions/taekwondo/kyorugui/matches/:matchId/rounds
   * Actualizar múltiples rounds a la vez
   */
  @Post('matches/:matchId/rounds')
  async updateRounds(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: UpdateKyoruguiRoundsDto,
  ) {
    return await this.kyoruguiService.updateRounds(matchId, dto);
  }

  /**
   * GET /competitions/taekwondo/kyorugui/matches/:matchId/rounds
   * Obtener todos los rounds de un match
   */
  @Get('matches/:matchId/rounds')
  async getMatchRounds(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.kyoruguiService.getMatchRounds(matchId);
  }

  /**
   * DELETE /competitions/taekwondo/kyorugui/matches/:matchId/rounds/:roundNumber
   * Eliminar un round específico
   */
  @Delete('matches/:matchId/rounds/:roundNumber')
  async deleteRound(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
  ) {
    await this.kyoruguiService.deleteRound(matchId, roundNumber);
    return { 
      message: `Round ${roundNumber} eliminado exitosamente` 
    };
  }

  // ========== ENDPOINTS EXISTENTES (Mantener compatibilidad) ==========

  /**
   * GET /competitions/taekwondo/kyorugui/phases/:phaseId/bracket
   * Obtener bracket con scores
   */
  @Get('phases/:phaseId/bracket')
  async getBracketWithScores(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return await this.kyoruguiService.getBracketWithScores(phaseId);
  }

  /**
   * GET /competitions/taekwondo/kyorugui/matches/:matchId
   * Obtener detalles del match (ahora incluye rounds)
   */
  @Get('matches/:matchId')
  async getMatchDetails(@Param('matchId', ParseIntPipe) matchId: number) {
    return await this.kyoruguiService.getMatchDetails(matchId);
  }
}
