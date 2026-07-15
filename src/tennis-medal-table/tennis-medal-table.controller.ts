// src/tennis-medal-table/tennis-medal-table.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { TennisMedalTableService } from './tennis-medal-table.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('tennis-medal-table')
export class TennisMedalTableController {
  constructor(private readonly service: TennisMedalTableService) {}

  // GET /tennis-medal-table/external/223/local-sport/3/summary   ← Tenis de campo
  // GET /tennis-medal-table/external/223/local-sport/8/summary   ← Tenis de mesa
  @Get('external/:externalEventId/local-sport/:localSportId/summary')
  @Public()
  getSummary(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
  ) {
    return this.service.getMedalSummary(externalEventId, localSportId);
  }

  // GET /tennis-medal-table/external/223/local-sport/3/institution/45/detail
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