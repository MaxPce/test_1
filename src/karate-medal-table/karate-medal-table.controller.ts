// src/karate-medal-table/karate-medal-table.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { KarateMedalTableService } from './karate-medal-table.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('karate-medal-table')
export class KarateMedalTableController {
  constructor(private readonly service: KarateMedalTableService) {}

  // GET /karate-medal-table/external/223/local-sport/9/summary
  @Get('external/:externalEventId/local-sport/:localSportId/summary')
  @Public()
  getSummary(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
  ) {
    return this.service.getMedalSummary(externalEventId, localSportId);
  }

  // GET /karate-medal-table/external/223/local-sport/9/institution/45/detail
  @Get('external/:externalEventId/local-sport/:localSportId/institution/:institutionId/detail')
  @Public()
  getInstitutionDetail(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
    @Param('institutionId',   ParseIntPipe) institutionId:   number,
  ) {
    return this.service.getMedalDetailByInstitution(
      externalEventId,
      localSportId,
      institutionId,
    );
  }
}