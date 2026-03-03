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

@Controller('sismaster')
export class SismasterController {
  constructor(private readonly sismasterService: SismasterService) {}

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
  ) {
    return await this.sismasterService.getAccreditedAthletes({
      idevent,
      gender,
      idinstitution: idinstitution ? Number(idinstitution) : undefined,
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
   * GET /sismaster/sports/:id/params/by-event/:eventId
   *
   * Categorías de un deporte que tienen atletas inscritos en un evento concreto.
   * Incluye athleteCount por categoría para mostrarlo en el selector del frontend.
   *
   * Ejemplo: /sismaster/sports/10/params/by-event/3
   *   → categorías de KARATE (sismaster_sport_id=10) con atletas en el evento 3
   */
  @Get('sports/:id/params/by-event/:eventId')
  async getSportParamsByEvent(
    @Param('id',      ParseIntPipe) idsport: number,
    @Param('eventId', ParseIntPipe) idevent: number,
  ) {
    return await this.sismasterService.getSportParamsByEvent(idsport, idevent);
  }

  /**
   * GET /sismaster/athletes/by-category
   *
   * Atletas inscritos en una categoría específica de un evento/deporte.
   * Los tres parámetros son OBLIGATORIOS para que la query sea precisa.
   *
   * Ejemplo: /sismaster/athletes/by-category?idevent=3&idsport=10&idparam=55
   */
  @Get('athletes/by-category')
  async getAthletesByCategory(
    @Query('idevent',  ParseIntPipe) idevent:  number,
    @Query('idsport',  ParseIntPipe) idsport:  number,
    @Query('idparam',  ParseIntPipe) idparam:  number,
  ) {
    return await this.sismasterService.getAthletesByCategory(
      idevent,
      idsport,
      idparam,
    );
  }

  /**
   * GET /sismaster/sports/local/:localSportId/params/by-event/:sismasterEventId
   *
   * Categorías con atletas inscritos. Recibe el ID local del deporte
   * (el que viene en la URL del frontend) y el ID del evento en Sismaster.
   * El mapping local → sismaster_sport_id se hace en el backend.
   *
   * Ejemplo: /sismaster/sports/local/1/params/by-event/3
   *   → categorías de sport_id=1 (KARATE, sismaster_sport_id=10) en el evento 3
   */
  @Get('sports/local/:localSportId/params/by-event/:sismasterEventId')
  async getSportParamsByLocalSport(
    @Param('localSportId',     ParseIntPipe) localSportId:     number,
    @Param('sismasterEventId', ParseIntPipe) sismasterEventId: number,
  ) {
    return await this.sismasterService.getSportParamsByLocalSportId(
      localSportId,
      sismasterEventId,
    );
  }

  /**
   * GET /sismaster/athletes/by-category-local
   *
   * Atletas por categoría. Recibe localSportId (no el de sismaster).
   * Ejemplo: /sismaster/athletes/by-category-local?sismasterEventId=3&localSportId=1&idparam=55
   */
  @Get('athletes/by-category-local')
  async getAthletesByCategoryLocal(
    @Query('sismasterEventId', ParseIntPipe) sismasterEventId: number,
    @Query('localSportId',     ParseIntPipe) localSportId:     number,
    @Query('idparam',          ParseIntPipe) idparam:          number,
  ) {
    return await this.sismasterService.getAthletesByCategoryLocal(
      sismasterEventId,
      localSportId,
      idparam,
    );
  }


}
