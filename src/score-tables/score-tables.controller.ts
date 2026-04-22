// src/score-tables/score-tables.controller.ts
import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ScoreTablesService } from './score-tables.service';

@Controller('score-tables')
export class ScoreTablesController {
  constructor(private readonly service: ScoreTablesService) {}

  // GET /score-tables/external/223/sport/2/summary
  @Get('external/:externalEventId/local-sport/:localSportId/summary')
  getSummary(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
  ) {
    return this.service.getScoreSummary(externalEventId, localSportId);
  }

  // POST /score-tables/external/223/sport/2/recalculate
  @Post('external/:externalEventId/local-sport/:localSportId/recalculate')
  recalculate(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
  ) {
    return this.service.recalculateEvent(externalEventId, localSportId);
  }
}