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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
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

  @Get('phases/deleted')
  @Roles(UserRole.ADMIN)
  findDeletedPhases() {
    return this.competitionsService.findDeletedPhases();
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
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async removePhase(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    await this.competitionsService.removePhase(id, user.userId);
    return { message: 'Fase eliminada correctamente' };
  }

  @Patch('phases/:id/restore')
  @Roles(UserRole.ADMIN)
  restorePhase(@Param('id', ParseIntPipe) id: number) {
    return this.competitionsService.restorePhase(id);
  }

  @Delete('phases/:id/hard')
  @Roles(UserRole.ADMIN)
  async hardDeletePhase(@Param('id', ParseIntPipe) id: number) {
    await this.competitionsService.hardDeletePhase(id);
    return { message: 'Fase eliminada permanentemente' };
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

  @Get('matches/deleted')
  @Roles(UserRole.ADMIN)
  findDeletedMatches() {
    return this.competitionsService.findDeletedMatches();
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
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async removeMatch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    await this.competitionsService.removeMatch(id, user.userId);
    return { message: 'Match eliminado correctamente' };
  }

  @Patch('matches/:id/restore')
  @Roles(UserRole.ADMIN)
  restoreMatch(@Param('id', ParseIntPipe) id: number) {
    return this.competitionsService.restoreMatch(id);
  }

  @Delete('matches/:id/hard')
  @Roles(UserRole.ADMIN)
  async hardDeleteMatch(@Param('id', ParseIntPipe) id: number) {
    await this.competitionsService.hardDeleteMatch(id);
    return { message: 'Match eliminado permanentemente' };
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

  @Post('participations/:id/lineup')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async setLineup(
    @Param('id', ParseIntPipe) participationId: number,
    @Body() dto: SetMatchLineupDto,
  ) {
    return this.tableTennisService.setLineup(participationId, dto);
  }

  @Get('matches/:id/lineups')
  @Public()
  async getMatchLineups(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.getMatchLineups(matchId);
  }

  // ==================== TENIS DE MESA - GAMES ====================

  @Post('matches/:id/generate-games')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async generateGames(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.generateGames(matchId);
  }

  @Get('matches/:id/games')
  @Public()
  async getMatchGames(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.getMatchGames(matchId);
  }

  @Patch('games/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async updateGameResult(
    @Param('id', ParseIntPipe) gameId: number,
    @Body() dto: UpdateMatchGameDto,
  ) {
    return this.tableTennisService.updateGameResult(gameId, dto);
  }

  // ==================== TENIS DE MESA - MATCH DETAILS ====================

  @Get('matches/:id/table-tennis')
  @Public()
  async getTableTennisMatchDetails(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.getMatchDetails(matchId);
  }

  @Get('matches/:id/result')
  @Public()
  async calculateMatchResult(@Param('id', ParseIntPipe) matchId: number) {
    return this.tableTennisService.calculateMatchResult(matchId);
  }

  // ==================== TENIS DE MESA - FINALIZE MATCH ====================

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

  // ==================== POOMSAE ENDPOINTS ====================

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

  @Post('brackets/generate-complete')
  async generateCompleteBracket(@Body() dto: GenerateBracketDto) {
    return this.bracketService.generateCompleteBracket(dto);
  }

  @Post('matches/advance-winner')
  async advanceWinner(@Body() dto: AdvanceWinnerDto) {
    return this.bracketService.advanceWinner(dto);
  }

  @Get('brackets/:phaseId/structure')
  async getBracketStructure(@Param('phaseId') phaseId: string) {
    return this.bracketService.getBracketStructure(+phaseId);
  }

  @Get('brackets/:phaseId/is-complete')
  async isBracketComplete(@Param('phaseId') phaseId: string) {
    const isComplete = await this.bracketService.isBracketComplete(+phaseId);
    return { phaseId: +phaseId, isComplete };
  }

  @Get('brackets/:phaseId/champion')
  async getChampion(@Param('phaseId') phaseId: string) {
    return this.bracketService.getChampion(+phaseId);
  }

  @Get('brackets/:phaseId/third-place')
  async getThirdPlace(@Param('phaseId') phaseId: string) {
    return this.bracketService.getThirdPlace(+phaseId);
  }

  @Patch('registrations/:id/seed')
  updateRegistrationSeed(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { seedNumber: number | null },
  ) {
    return this.competitionsService.updateRegistrationSeed(id, dto.seedNumber);
  }

  @Post('phases/:id/process-byes')
  processPhaseByesAutomatically(@Param('id', ParseIntPipe) phaseId: number) {
    return this.competitionsService.processPhaseByesAutomatically(phaseId);
  }

  @Post('table-tennis/matches/:matchId/walkover')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async setTableTennisWalkover(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: { winnerRegistrationId: number; reason?: string },
  ) {
    return this.tableTennisService.setWalkover(
      matchId,
      dto.winnerRegistrationId,
      dto.reason,
    );
  }

}
