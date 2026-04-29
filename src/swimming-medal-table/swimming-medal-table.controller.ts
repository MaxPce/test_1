// src/swimming-medal-table/swimming-medal-table.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { SwimmingMedalTableService } from './swimming-medal-table.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('swimming-medal-table')
export class SwimmingMedalTableController {
  constructor(private readonly service: SwimmingMedalTableService) {}

  // GET /swimming-medal-table/external/223/local-sport/X/summary
  @Get('external/:externalEventId/local-sport/:localSportId/summary')
  @Public()
  getSummary(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
  ) {
    return this.service.getMedalSummary(externalEventId, localSportId);
  }
}