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


}
