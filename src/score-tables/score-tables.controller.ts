// src/score-tables/score-tables.controller.ts
import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ScoreTablesService } from './score-tables.service';

@Controller('score-tables')
export class ScoreTablesController {
  constructor(private readonly service: ScoreTablesService) {}

  // GET /score-tables/:eventId/summary → las 5 tablas
  @Get(':eventId/summary')
  getSummary(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.getScoreSummary(eventId);
  }

  // POST /score-tables/:eventId/recalculate → recalcula todo desde cero
  @Post(':eventId/recalculate')
  recalculate(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.recalculateEvent(eventId);
  }
}