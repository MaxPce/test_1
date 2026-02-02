// src/competitions/competitions.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { TableTennisService } from './table-tennis.service';
import { BracketService } from './bracket.service';
import {
  CreatePhaseDto,
  UpdatePhaseDto,
  CreateMatchDto,
  UpdateMatchDto,
  CreateParticipationDto,
  GenerateBracketDto,
  InitializeRoundRobinDto,
  SetMatchLineupDto,
  UpdateMatchGameDto,
  AdvanceWinnerDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { MatchStatus } from '../common/enums';
import { TaekwondoKyoruguiService } from './taekwondo-kyorugui.service';
import { TaekwondoPoomsaeService } from './taekwondo-poomsae.service';
import { UpdateKyoruguiScoreDto } from './dto/update-kyorugui-score.dto';
import { UpdatePoomsaeScoreDto } from './dto/update-poomsae-score.dto';

@Controller('competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompetitionsController {
  constructor(
    private readonly competitionsService: CompetitionsService,
    private readonly tableTennisService: TableTennisService,
    private readonly taekwondoKyoruguiService: TaekwondoKyoruguiService,
    private readonly taekwondoPoomsaeService: TaekwondoPoomsaeService,
    private readonly bracketService: BracketService,
  ) {}

  // ==================== PHASES ====================

  @Post('phases')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createPhase(@Body() createDto: CreatePhaseDto) {
    return this.competitionsService.createPhase(createDto);
  }

  @Get('phases')
  @Public()
  findAllPhases(@Query('eventCategoryId') eventCategoryId?: string) {
    const eventCategoryIdNum = eventCategoryId
      ? parseInt(eventCategoryId, 10)
      : undefined;
    return this.competitionsService.findAllPhases(eventCategoryIdNum);
  }

  @Get('phases/:id')
  @Public()
  findOnePhase(@Param('id', ParseIntPipe) id: number) {
    return this.competitionsService.findOnePhase(id);
  }

  @Patch('phases/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updatePhase(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdatePhaseDto,
  ) {
    return this.competitionsService.updatePhase(id, updateDto);
  }

  @Delete('phases/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR) // ✅ Cambiado: antes solo ADMIN
  removePhase(@Param('id', ParseIntPipe) id: number) {
    return this.competitionsService.removePhase(id);
  }

  // ==================== MATCHES ====================

  @Post('matches')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createMatch(@Body() createDto: CreateMatchDto) {
    return this.competitionsService.createMatch(createDto);
  }

  @Get('matches')
  @Public()
  findAllMatches(
    @Query('phaseId') phaseId?: string,
    @Query('status') status?: MatchStatus,
  ) {
    const phaseIdNum = phaseId ? parseInt(phaseId, 10) : undefined;
    return this.competitionsService.findAllMatches(phaseIdNum, status);
  }

  @Get('matches/:id')
  @Public()
  findOneMatch(@Param('id', ParseIntPipe) id: number) {
    return this.competitionsService.findOneMatch(id);
  }

  @Patch('matches/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateMatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateMatchDto,
  ) {
    return this.competitionsService.updateMatch(id, updateDto);
  }

  @Delete('matches/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR) // ✅ Cambiado: antes solo ADMIN
  removeMatch(@Param('id', ParseIntPipe) id: number) {
    return this.competitionsService.removeMatch(id);
  }

  // ==================== PARTICIPATIONS ====================

  @Post('participations')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createParticipation(@Body() createDto: CreateParticipationDto) {
    return this.competitionsService.createParticipation(createDto);
  }

  @Get('matches/:matchId/participations')
  @Public()
  findParticipationsByMatch(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.competitionsService.findParticipationsByMatch(matchId);
  }

  @Delete('matches/:matchId/participations/:registrationId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  removeParticipation(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Param('registrationId', ParseIntPipe) registrationId: number,
  ) {
    return this.competitionsService.removeParticipation(
      matchId,
      registrationId,
    );
  }

  // ==================== BRACKET GENERATION ====================

  @Post('brackets/generate')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  generateBracket(@Body() dto: GenerateBracketDto) {
    return this.competitionsService.generateBracket(dto);
  }

  @Post('round-robin/initialize')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  initializeRoundRobin(@Body() dto: InitializeRoundRobinDto) {
    return this.competitionsService.initializeRoundRobin(dto);
  }

  // ==================== STANDINGS ====================

  @Get('phases/:phaseId/standings')
  @Public()
  getStandings(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.competitionsService.getStandings(phaseId);
  }

  @Post('phases/:phaseId/standings/update')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateStandings(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.competitionsService.updateStandings(phaseId);
  }

  // ==================== BEST OF 3 ====================

  @Post('phases/:phaseId/initialize-best-of-3')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async initializeBestOf3(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body('registrationIds') registrationIds: number[],
  ) {
    return this.competitionsService.initializeBestOf3Series(
      phaseId,
      registrationIds,
    );
  }

  @Patch('matches/:matchId/best-of-3-result')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async updateBestOf3Result(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body('winnerRegistrationId', ParseIntPipe) winnerRegistrationId: number,
  ) {
    return this.competitionsService.updateBestOf3MatchResult(
      matchId,
      winnerRegistrationId,
    );
  }

  // ==================== TENIS DE MESA - LINEUPS ====================

  /**
   * Configurar lineup de un equipo para un match
   * POST /competitions/participations/:id/lineup
   */
  @Post('participations/:id/lineup')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async setLineup(
    @Param('id', ParseIntPipe) participationId: number,
    @Body() dto: SetMatchLineupDto,
  ) {
    return this.tableTennisService.setLineup(participationId, dto);
  }

  /**
   * Obtener lineups de un match (ambos equipos)
   * GET /competitions/matches/:id/lineups
   */
  @Get('matches/:id/lineups')
  @Public()
  async getMatchLineups(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.getMatchLineups(matchId);
  }

  // ==================== TENIS DE MESA - GAMES ====================

  /**
   * Generar juegos automáticamente para un match
   * POST /competitions/matches/:id/generate-games
   */
  @Post('matches/:id/generate-games')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async generateGames(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.generateGames(matchId);
  }

  /**
   * Obtener todos los juegos de un match
   * GET /competitions/matches/:id/games
   */
  @Get('matches/:id/games')
  @Public()
  async getMatchGames(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.getMatchGames(matchId);
  }

  /**
   * Actualizar resultado de un juego individual
   * PATCH /competitions/games/:id
   */
  @Patch('games/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async updateGameResult(
    @Param('id', ParseIntPipe) gameId: number,
    @Body() dto: UpdateMatchGameDto,
  ) {
    return this.tableTennisService.updateGameResult(gameId, dto);
  }

  // ==================== TENIS DE MESA - MATCH DETAILS ====================

  /**
   * Obtener detalles completos de un match de tenis de mesa
   * GET /competitions/matches/:id/table-tennis
   */
  @Get('matches/:id/table-tennis')
  @Public()
  async getTableTennisMatchDetails(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.getMatchDetails(matchId);
  }

  /**
   * Calcular resultado actual del match
   * GET /competitions/matches/:id/result
   */
  @Get('matches/:id/result')
  @Public()
  async calculateMatchResult(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.calculateMatchResult(matchId);
  }

  // ==================== TENIS DE MESA - FINALIZE MATCH ====================

  /**
   * Finalizar match manualmente (marcar como finalizado)
   * PATCH /competitions/matches/:id/finalize
   */
  @Patch('matches/:id/finalize')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async finalizeMatch(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.finalizeMatch(matchId);
  }
  @Patch('matches/:id/reopen')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async reopenMatch(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.reopenMatch(matchId);
  }

  // ===== KYORUGUI ENDPOINTS =====

  @Patch('matches/:matchId/kyorugui-score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async updateKyoruguiScore(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() updateDto: UpdateKyoruguiScoreDto,
  ) {
    return this.taekwondoKyoruguiService.updateMatchScore(matchId, updateDto);
  }

  @Get('matches/:matchId/kyorugui-details')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getKyoruguiMatchDetails(
    @Param('matchId', ParseIntPipe) matchId: number,
  ) {
    return this.taekwondoKyoruguiService.getMatchDetails(matchId);
  }

  @Get('phases/:phaseId/kyorugui-bracket')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getKyoruguiBracket(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.taekwondoKyoruguiService.getBracketWithScores(phaseId);
  }

  // ===== POOMSAE ENDPOINTS =====

  @Patch('participations/:participationId/poomsae-score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async updatePoomsaeScore(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() updateDto: UpdatePoomsaeScoreDto,
  ) {
    return this.taekwondoPoomsaeService.updatePoomsaeScore(
      participationId,
      updateDto,
    );
  }

  @Get('phases/:phaseId/poomsae-table')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getPoomsaeScoreTable(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.taekwondoPoomsaeService.getPhaseScores(phaseId);
  }

  @Get('participations/:participationId/poomsae-score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getPoomsaeScore(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return this.taekwondoPoomsaeService.getParticipationScore(participationId);
  }
  // ==================== ENDPOINTS DE BRACKET ====================

  /**
   * Generar bracket completo con tercer lugar
   */
  @Post('brackets/generate-complete')
  async generateCompleteBracket(@Body() dto: GenerateBracketDto) {
    return this.bracketService.generateCompleteBracket(dto);
  }

  /**
   * Avanzar ganador automáticamente
   */
  @Post('matches/advance-winner')
  async advanceWinner(@Body() dto: AdvanceWinnerDto) {
    return this.bracketService.advanceWinner(dto);
  }

  /**
   * Obtener estructura completa del bracket
   */
  @Get('brackets/:phaseId/structure')
  async getBracketStructure(@Param('phaseId') phaseId: string) {
    return this.bracketService.getBracketStructure(+phaseId);
  }

  /**
   * Verificar si el bracket está completo
   */
  @Get('brackets/:phaseId/is-complete')
  async isBracketComplete(@Param('phaseId') phaseId: string) {
    const isComplete = await this.bracketService.isBracketComplete(+phaseId);
    return { phaseId: +phaseId, isComplete };
  }

  /**
   * Obtener campeón del bracket
   */
  @Get('brackets/:phaseId/champion')
  async getChampion(@Param('phaseId') phaseId: string) {
    return this.bracketService.getChampion(+phaseId);
  }

  /**
   * Obtener tercer lugar
   */
  @Get('brackets/:phaseId/third-place')
  async getThirdPlace(@Param('phaseId') phaseId: string) {
    return this.bracketService.getThirdPlace(+phaseId);
  }
}
