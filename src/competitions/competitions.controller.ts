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
import {
  CreatePhaseDto,
  UpdatePhaseDto,
  CreateMatchDto,
  UpdateMatchDto,
  CreateParticipationDto,
  GenerateBracketDto,
  InitializeRoundRobinDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { MatchStatus } from '../common/enums';

@Controller('competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
}
