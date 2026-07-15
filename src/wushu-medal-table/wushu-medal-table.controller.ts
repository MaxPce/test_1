// src/wushu-medal-table/wushu-medal-table.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { WushuMedalTableService } from './wushu-medal-table.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('wushu-medal-table')
export class WushuMedalTableController {
  constructor(private readonly service: WushuMedalTableService) {}

  // GET /wushu-medal-table/external/223/local-sport/11/summary
  @Get('external/:externalEventId/local-sport/:localSportId/summary')
  @Public()
  getSummary(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
  ) {
    return this.service.getMedalSummary(externalEventId, localSportId);
  }

  // GET /wushu-medal-table/external/223/local-sport/11/institution/45/detail
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