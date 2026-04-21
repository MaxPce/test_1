import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AthleticsService } from './athletics.service';
import { CreateAthleticsResultDto } from './dto/create-athletics-result.dto';
import { UpdateAthleticsResultDto } from './dto/update-athletics-result.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { GenerateAthleticsSeriesDto } from './dto/generate-athletics-series.dto';
import {
  CreateAthleticsSectionDto,
  UpdateAthleticsSectionDto,
} from './dto/athletics-section.dto';
import {
  AssignSectionEntriesDto,
  UpsertSectionEntryDto,
} from './dto/athletics-section-entry.dto';
import { MoveEntrySectionDto } from './dto/move-entry-section.dto';
import { AthleticsClassificationService } from './athletics-classification.service';

@Controller('competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AthleticsController {
  constructor(
  private readonly athleticsService: AthleticsService,
  private readonly classificationService: AthleticsClassificationService, 
  ) {}

  // POST /competitions/athletics
  // ==================== ATHLETICS RESULTS ====================

  @Post('athletics')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  create(@Body() dto: CreateAthleticsResultDto) {
    return this.athleticsService.create(dto);
  }

  // ── Secciones — estáticas PRIMERO ────────────────────────────────────────────

  @Get('athletics/sections')
  @Public()
  getSectionsByPhase(@Query('phaseId', ParseIntPipe) phaseId: number) {
    return this.athleticsService.getSectionsByPhase(phaseId);
  }

  @Post('athletics/sections')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  createSection(@Body() dto: CreateAthleticsSectionDto) {
    return this.athleticsService.createSection(dto);
  }

  @Post('athletics/sections/assign')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  assignSectionEntries(@Body() dto: AssignSectionEntriesDto) {
    return this.athleticsService.assignSectionEntries(dto);
  }

  @Patch('athletics/sections/entry')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  upsertSectionEntry(@Body() dto: UpsertSectionEntryDto) {
    return this.athleticsService.upsertSectionEntry(dto);
  }

  @Patch('athletics/section-entries/:entryId/move')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR) 
  moveEntryToSection(
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: MoveEntrySectionDto,
  ) {
    return this.athleticsService.moveEntryToSection(entryId, dto);
  }

  @Post('phases/:eventCategoryId/generate-series')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async generateSeries(
    @Param('eventCategoryId', ParseIntPipe) eventCategoryId: number,
    @Body() dto: GenerateAthleticsSeriesDto,                          // ← NUEVO
  ) {
    return this.athleticsService.generateAthleticsPhasesBySeries(eventCategoryId, dto);
  }

  // ── Secciones — dinámicas DESPUÉS ────────────────────────────────────────────

  @Patch('athletics/sections/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  updateSection(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAthleticsSectionDto,
  ) {
    return this.athleticsService.updateSection(id, dto);
  }

  @Delete('athletics/sections/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  deleteSection(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.deleteSection(id);
  }

  // ── Resultados individuales ───────────────────────────────────────────────────

  @Get('athletics/:id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.findOne(id);
  }

  @Patch('athletics/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAthleticsResultDto,
  ) {
    return this.athleticsService.update(id, dto);
  }

  @Delete('athletics/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.remove(id);
  }

  // ==================== PHASES (athletics) ====================

  // GET /competitions/phases/:phaseId/athletics-field-table
  @Get('phases/:phaseId/athletics-field-table')
  @Public()
  getFullFieldTable(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.athleticsService.findFullFieldTable(phaseId);
  }

  @Get('phases/:phaseId/athletics-table')
  @Public()
  findByPhase(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.athleticsService.findByPhase(phaseId);
  }

  @Get('phases/:phaseId/athletics-track-table')
  @Public()
  getFullTrackTable(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.athleticsService.findFullTrackTable(phaseId);
  }

  @Get('phases/:phaseId/athletics-ranking/track')
  @Public()
  getRankingTrack(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Query('sectionId', new ParseIntPipe({ optional: true }))
    sectionId?: number,
  ) {
    return this.athleticsService.getRankingTrack(phaseId, sectionId);
  }

  @Get('phases/:phaseId/athletics-ranking/field')
  @Public()
  getRankingField(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.athleticsService.getRankingField(phaseId);
  }

  // POST /competitions/phases/:phaseId/classify
  // Cierra la fase y genera el ranking + actualiza score_table
  @Post('phases/:phaseId/classify')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  classifyPhase(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.classificationService.classifyPhase(phaseId);
  }

  // GET /competitions/phases/:phaseId/classification
  // Ver el ranking ya calculado
  @Get('phases/:phaseId/classification')
  @Public()
  getClassification(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.classificationService.getClassification(phaseId);
  }

  

  // ==================== PHASE REGISTRATIONS ====================

  @Get('phase-registrations/:id/athletics')
  @Public()
  findByPhaseRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.findByPhaseRegistration(id);
  }

  @Delete('phase-registrations/:id/athletics/reset')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  reset(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.resetPhaseRegistration(id);
  }
  @Delete('phase-registrations/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  removePhaseRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.removePhaseRegistration(id);
  }

  // PATCH /competitions/phase-registrations/:id/rank-override
  // Corrección manual de puesto (edge cases de empate técnico)
  @Patch('phase-registrations/:id/rank-override')
  @Roles(UserRole.ADMIN)
  overrideRank(
    @Param('id', ParseIntPipe) id: number,
    @Body('rankPosition', ParseIntPipe) rankPosition: number,
  ) {
    return this.classificationService.overrideRank(id, rankPosition);
  }

 
}
