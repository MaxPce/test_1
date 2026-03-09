import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  Body,
  Post,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SismasterService } from './sismaster.service';
import { BadRequestException } from '@nestjs/common';
import { CompetitionSnapshotService } from './competition-snapshot.service';



@Controller('sismaster')
export class SismasterController {
  
  logger: any;
  constructor(
    private readonly sismasterService: SismasterService,
    private readonly competitionSnapshotService: CompetitionSnapshotService, 
  ) {}

  /**
   * GET /sismaster/competition-snapshot/:eventId
   *
   * JSON completo de la competencia para consumo externo (sismaster).
   * Incluye: evento → deportes → categorías → inscripciones (enriquecidas
   * con sismaster) → fases → matches (participantes + puntajes) → standings.
   *
   * Ejemplo: GET /sismaster/competition-snapshot/1
   */
  @Get('competition-snapshot/:eventId')
  async getCompetitionSnapshot(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('sportId') sportId?: string,
    @Query('eventCategoryId') eventCategoryId?: string,
    @Query('phaseId') phaseId?: string,
  ) {
    return this.competitionSnapshotService.getCompetitionSnapshot(eventId, {
      sportId: sportId ? Number(sportId) : undefined,
      eventCategoryId: eventCategoryId ? Number(eventCategoryId) : undefined,
      phaseId: phaseId ? Number(phaseId) : undefined,
    });
  }


  /**
   * GET /sismaster/events
   * Listar todos los eventos de Sismaster
   */
  @Get('events')
  async getAllEvents() {
    return await this.sismasterService.getAllEvents();
  }

  /**
   * GET /sismaster/events/:id
   * Obtener un evento específico
   */
  @Get('events/:id')
  async getEventById(@Param('id', ParseIntPipe) id: number) {
    return await this.sismasterService.getEventById(id);
  }

  /**
   * GET /sismaster/sports
   * Listar todos los deportes
   */
  @Get('sports')
  async getAllSports() {
    return await this.sismasterService.getAllSports();
  }

  /**
   * GET /sismaster/sports/:id
   * Obtener un deporte específico
   */
  @Get('sports/:id')
  async getSportById(@Param('id', ParseIntPipe) id: number) {
    return await this.sismasterService.getSportById(id);
  }

  /**
   * GET /sismaster/athletes/accredited
   */
  @Get('athletes/accredited')
  async getAccreditedAthletes(
    @Query('idevent', ParseIntPipe) idevent: number,
    @Query('gender') gender?: 'M' | 'F',
    @Query('idinstitution') idinstitution?: number,
    @Query('localSportId') localSportId?: number,
  ) {
    return await this.sismasterService.getAccreditedAthletes({
      idevent,
      gender,
      idinstitution: idinstitution ? Number(idinstitution) : undefined,
      localSportId: localSportId ? Number(localSportId) : undefined,
    });
  }

  /**
   * GET /sismaster/athletes/search
   * Buscar atletas por nombre o documento
   * Ejemplo: /sismaster/athletes/search?q=Juan
   */
  @Get('athletes/search')
  async searchAthletes(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number,
  ) {
    return await this.sismasterService.searchAthletesByName(
      searchTerm,
      limit ? Number(limit) : 20,
    );
  }

  /**
   * GET /sismaster/athletes/count
   * Obtener el total de atletas registrados
   */
  @Get('athletes/count')
  async getAthletesCount() {
    const count = await this.sismasterService.getAthletesCount();
    return { count };
  }

  @Get('athletes/by-category-name')
  async getAthletesByCategoryName(
    
    @Query('sismasterEventId') sismasterEventIdRaw: string,
    @Query('localSportId') localSportIdRaw: string,
    @Query('categoryName') categoryName: string,
  ) {
    
    const sismasterEventId = Number(sismasterEventIdRaw);
    const localSportId = Number(localSportIdRaw);

    return await this.sismasterService.getAthletesByCategoryName(
      sismasterEventId,
      localSportId,
      categoryName,
    );
  }

  /**
   * GET /sismaster/athletes/by-category-local
   * Atletas por categoría específica usando localSportId e idparam de Sismaster.
   * Ejemplo: /sismaster/athletes/by-category-local?sismasterEventId=200&localSportId=3&idparam=262
   */
  @Get('athletes/by-category-local')
  async getAthletesByCategoryLocal(
    @Query('sismasterEventId', new ParseIntPipe({ errorHttpStatusCode: 400 })) sismasterEventId: number,
    @Query('localSportId', new ParseIntPipe({ errorHttpStatusCode: 400 })) localSportId: number,
    @Query('idparam', new ParseIntPipe({ errorHttpStatusCode: 400 })) idparam: number,
  ) {
    return await this.sismasterService.getAthletesByCategoryLocal(
      sismasterEventId,
      localSportId,
      idparam,
    );
  }

  /**
   * GET /sismaster/athletes/niv-cat-options
   * Opciones de idniv e idcat disponibles para un evento+deporte
   */
  @Get('athletes/niv-cat-options')
  async getNivCatOptions(
    @Query('sismasterEventId', ParseIntPipe) sismasterEventId: number,
    @Query('sismasterSportId', ParseIntPipe) sismasterSportId: number,
    @Query('eventCategoryId') eventCategoryIdRaw?: string,
  ) {
    return this.sismasterService.getNivCatOptions(
      sismasterEventId,
      sismasterSportId,
      eventCategoryIdRaw ? Number(eventCategoryIdRaw) : undefined,
    );
  }

  /**
   * GET /sismaster/athletes/by-niv-cat
   * Atletas filtrados por idniv + idcat
   * Ej: ?sismasterEventId=101&localSportId=3&idniv=NV&idcat=M
   */
  @Get('athletes/by-niv-cat')
  async getAthletesByNivAndCat(
    @Query('sismasterEventId', new ParseIntPipe({ errorHttpStatusCode: 400 }))
    sismasterEventId: number,
    @Query('localSportId', new ParseIntPipe({ errorHttpStatusCode: 400 }))
    localSportId: number,
    @Query('idniv') idniv: string,
    @Query('idcat') idcat: string,
  ) {
    return this.sismasterService.getAthletesByNivAndCat(
      sismasterEventId,
      localSportId,
      idniv,
      idcat,
    );
  }
  /**
   * GET /sismaster/athletes/registrations-by-niv-cat
   * Devuelve registration_ids locales cruzando sismaster (idniv + idcat) con formatos_db
   *
   * Query params:
   *   sismasterEventId  : number   (requerido)
   *   localSportId      : number   (requerido)
   *   idniv             : string   (requerido)  ej: 'NV', 'AZ'
   *   idcat             : string   (requerido)  ej: 'M', 'F'
   *   eventCategoryId   : number   (opcional)   para filtrar por categoría local
   */
  @Get('athletes/registrations-by-niv-cat')
  async getRegistrationIdsByNivCat(
    @Query('sismasterEventId', new ParseIntPipe({ errorHttpStatusCode: 400 }))
    sismasterEventId: number,
    @Query('sismasterSportId', new ParseIntPipe({ errorHttpStatusCode: 400 }))
    sismasterSportId: number,
    @Query('idniv') idniv: string,
    @Query('idcat') idcat: string,
    @Query('eventCategoryId') eventCategoryIdRaw?: string,
  ) {
    return this.sismasterService.getRegistrationIdsByNivCat(
      sismasterEventId,
      sismasterSportId,
      idniv,
      idcat,
      eventCategoryIdRaw ? Number(eventCategoryIdRaw) : undefined,
    );
  }



  /**
   * GET /sismaster/athletes/:id
   * Obtener un atleta por ID
   */
  @Get('athletes/:id')
  async getAthleteById(@Param('id', ParseIntPipe) id: number) {
    return await this.sismasterService.getAthleteById(id);
  }

  /**
   * GET /sismaster/athletes/document/:docnumber
   * Obtener un atleta por documento
   */
  @Get('athletes/document/:docnumber')
  async getAthleteByDocument(@Param('docnumber') docnumber: string) {
    return await this.sismasterService.getAthleteByDocument(docnumber);
  }

  /**
   * GET /sismaster/institutions/:id
   * Obtener una institución por ID
   */
  @Get('institutions/:id')
  async getInstitutionById(@Param('id', ParseIntPipe) id: number) {
    return await this.sismasterService.getInstitutionById(id);
  }

  /**
   * GET /sismaster/institutions
   * Listar todas las instituciones
   */
  @Get('institutions')
  async getAllInstitutions() {
    return await this.sismasterService.getAllInstitutions();
  }

  /**
   * GET /sismaster/events/:idevent/sports
   * Deportes configurados para un evento 
   */
  @Get('events/:idevent/sports')
  async getSportsByEvent(@Param('idevent', ParseIntPipe) idevent: number) {
    return this.sismasterService.getSportsByEvent(idevent);
  }

  /**
   * GET /sismaster/sports/:id/params
   * TODAS las categorías de un deporte 
   */
  @Get('sports/:id/params')
  async getAllSportParams(@Param('id', ParseIntPipe) idsport: number) {
    return this.sismasterService.getAllSportParams(idsport);
  }

  

  

  /**
   * GET /sismaster/sports/local/:localSportId/params/by-event/:sismasterEventId
   * Categorías con atletas inscritos. Recibe localSportId y sismasterEventId.
   */
  @Get('sports/local/:localSportId/params/by-event/:sismasterEventId')
  async getSportParamsByLocalSport(
    @Param('localSportId', ParseIntPipe) localSportId: number,
    @Param('sismasterEventId', ParseIntPipe) sismasterEventId: number,
  ) {
    return await this.sismasterService.getSportParamsByLocalSportId(
      localSportId,
      sismasterEventId,
    );
  }

  







}
