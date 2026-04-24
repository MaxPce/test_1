// src/judo-medal-table/judo-medal-table.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { JudoMedalTableService } from './judo-medal-table.service';

@Controller('judo-medal-table')
export class JudoMedalTableController {
  constructor(private readonly service: JudoMedalTableService) {}

  // GET /judo-medal-table/external/223/local-sport/5/summary
  @Get('external/:externalEventId/local-sport/:localSportId/summary')
  getSummary(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
  ) {
    return this.service.getMedalSummary(externalEventId, localSportId);
  }
}