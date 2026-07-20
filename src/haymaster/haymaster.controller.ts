import {
  Controller, Get, Query, Param, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { HaymasterService } from './haymaster.service';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CompetitionPhaseReportService } from '../sismaster/competition-phase-report.service';

@Controller('haymaster')        // ← ruta base 'haymaster'
@UseGuards(JwtAuthGuard, RolesGuard)
export class HaymasterController {
  constructor(
    private readonly haymasterService: HaymasterService,
    private readonly competitionPhaseReportService: CompetitionPhaseReportService,  
  ) {}


  @Get('events')
  @Public()
  async getAllEvents() {
    return this.haymasterService.getAllEvents();
  }

  @Get('events/:id')
  @Public()
  async getEventById(@Param('id', ParseIntPipe) id: number) {
    return this.haymasterService.getEventById(id);
  }

  @Get('sports')
  @Public()
  async getAllSports() {
    return this.haymasterService.getAllSports();
  }

  @Get('sports/:id')
  @Public()
  async getSportById(@Param('id', ParseIntPipe) id: number) {
    return this.haymasterService.getSportById(id);
  }

  @Get('athletes/accredited')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getAccreditedAthletes(
    @Query('idevent', ParseIntPipe) idevent: number,
    @Query('gender') gender?: 'M' | 'F',
    @Query('idinstitution') idinstitution?: number,
    @Query('localSportId') localSportId?: number,
  ) {
    return this.haymasterService.getAccreditedAthletes({
      idevent,
      gender,
      idinstitution: idinstitution ? Number(idinstitution) : undefined,
      localSportId: localSportId ? Number(localSportId) : undefined,
    });
  }

  @Get('athletes/search')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async searchAthletes(@Query('q') searchTerm: string, @Query('limit') limit?: number) {
    return this.haymasterService.searchAthletesByName(searchTerm, limit ? Number(limit) : 20);
  }

  @Get('athletes/count')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getAthletesCount() {
    return { count: await this.haymasterService.getAthletesCount() };
  }

  @Get('athletes/by-category-name')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getAthletesByCategoryName(
    @Query('sismasterEventId') sismasterEventIdRaw: string,
    @Query('localSportId') localSportIdRaw: string,
    @Query('categoryName') categoryName: string,
  ) {
    return this.haymasterService.getAthletesByCategoryName(
      Number(sismasterEventIdRaw), Number(localSportIdRaw), categoryName,
    );
  }

  @Get('athletes/by-category-local')
  async getAthletesByCategoryLocal(
    @Query('haymasterEventId', new ParseIntPipe({ errorHttpStatusCode: 400 })) haymasterEventId: number,
    @Query('localSportId', new ParseIntPipe({ errorHttpStatusCode: 400 })) localSportId: number,
    @Query('idparam', new ParseIntPipe({ errorHttpStatusCode: 400 })) idparam: number,
  ) {
    if (!haymasterEventId || !localSportId || !idparam) {
      throw new BadRequestException('haymasterEventId, localSportId e idparam son requeridos');
    }
    return this.haymasterService.getAthletesByCategoryLocal(haymasterEventId, localSportId, idparam);
  }

  @Get('athletes/niv-cat-options')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getNivCatOptions(
    @Query('sismasterEventId', ParseIntPipe) sismasterEventId: number,
    @Query('sismasterSportId', ParseIntPipe) sismasterSportId: number,
    @Query('eventCategoryId') eventCategoryIdRaw?: string,
  ) {
    return this.haymasterService.getNivCatOptions(
      sismasterEventId, sismasterSportId,
      eventCategoryIdRaw ? Number(eventCategoryIdRaw) : undefined,
    );
  }

  @Get('athletes/by-niv-cat')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getAthletesByNivAndCat(
    @Query('sismasterEventId', new ParseIntPipe({ errorHttpStatusCode: 400 })) sismasterEventId: number,
    @Query('localSportId', new ParseIntPipe({ errorHttpStatusCode: 400 })) localSportId: number,
    @Query('idniv') idniv: string,
    @Query('idcat') idcat: string,
  ) {
    return this.haymasterService.getAthletesByNivAndCat(sismasterEventId, localSportId, idniv, idcat);
  }

  @Get('athletes/registrations-by-niv-cat')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getRegistrationIdsByNivCat(
    @Query('sismasterEventId', new ParseIntPipe({ errorHttpStatusCode: 400 })) sismasterEventId: number,
    @Query('sismasterSportId', new ParseIntPipe({ errorHttpStatusCode: 400 })) sismasterSportId: number,
    @Query('idniv') idniv: string,
    @Query('idcat') idcat: string,
    @Query('eventCategoryId') eventCategoryIdRaw?: string,
  ) {
    return this.haymasterService.getRegistrationIdsByNivCat(
      sismasterEventId, sismasterSportId, idniv, idcat,
      eventCategoryIdRaw ? Number(eventCategoryIdRaw) : undefined,
    );
  }

  @Get('athletes/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getAthleteById(@Param('id', ParseIntPipe) id: number) {
    return this.haymasterService.getAthleteById(id);
  }

  @Get('athletes/document/:docnumber')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getAthleteByDocument(@Param('docnumber') docnumber: string) {
    return this.haymasterService.getAthleteByDocument(docnumber);
  }

  @Get('institutions/:id')
  @Public()
  async getInstitutionById(@Param('id', ParseIntPipe) id: number) {
    return this.haymasterService.getInstitutionById(id);
  }

  @Get('institutions')
  @Public()
  async getAllInstitutions() {
    return this.haymasterService.getAllInstitutions();
  }

  @Get('events/:idevent/sports')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getSportsByEvent(@Param('idevent', ParseIntPipe) idevent: number) {
    return this.haymasterService.getSportsByEvent(idevent);
  }

  @Get('sports/:id/params')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getAllSportParams(@Param('id', ParseIntPipe) idsport: number) {
    return this.haymasterService.getAllSportParams(idsport);
  }

  @Get('sports/local/:localSportId/params/by-event/:sismasterEventId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getSportParamsByLocalSport(
    @Param('localSportId', ParseIntPipe) localSportId: number,
    @Param('sismasterEventId', ParseIntPipe) sismasterEventId: number,
  ) {
    return this.haymasterService.getSportParamsByLocalSportId(localSportId, sismasterEventId);
  }

  /**
   * GET /haymaster/competition-report/:eventId
   * idcompany = 1 (HAYMASTER) — hardcodeado en el servicio de datos externos
   *
   * GET /haymaster/competition-report/200
   * GET /haymaster/competition-report/200?sportId=7
   * GET /haymaster/competition-report/200?eventCategoryId=155
   * GET /haymaster/competition-report/200?eventCategoryId=155&phaseId=212
   */
  @Get('competition-report/:eventId')
  @Public()
  async getPhaseReport(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('sportId') sportId?: string,
    @Query('eventCategoryId') eventCategoryId?: string,
    @Query('phaseId') phaseId?: string,
  ) {
    return this.competitionPhaseReportService.getPhaseReport(eventId, {
      sportId:         sportId         ? Number(sportId)         : undefined,
      eventCategoryId: eventCategoryId ? Number(eventCategoryId) : undefined,
      phaseId:         phaseId         ? Number(phaseId)         : undefined,
    });
  }
}