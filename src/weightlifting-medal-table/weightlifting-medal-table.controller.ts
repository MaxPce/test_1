// src/weightlifting-medal-table/weightlifting-medal-table.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { WeightliftingMedalTableService } from './weightlifting-medal-table.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('weightlifting-medal-table')
export class WeightliftingMedalTableController {
  constructor(private readonly service: WeightliftingMedalTableService) {}

  // GET /weightlifting-medal-table/external/223/local-sport/5/summary
  @Get('external/:externalEventId/local-sport/:localSportId/summary')
  @Public()
  getSummary(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
  ) {
    return this.service.getMedalSummary(externalEventId, localSportId);
  }
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