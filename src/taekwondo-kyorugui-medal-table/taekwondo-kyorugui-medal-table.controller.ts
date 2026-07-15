// src/taekwondo-kyorugui-medal-table/taekwondo-kyorugui-medal-table.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { TaekwondoKyoruguiMedalTableService } from './taekwondo-kyorugui-medal-table.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('taekwondo-kyorugui-medal-table')
export class TaekwondoKyoruguiMedalTableController {
  constructor(private readonly service: TaekwondoKyoruguiMedalTableService) {}

  // GET /taekwondo-kyorugui-medal-table/external/223/local-sport/7/summary
  @Get('external/:externalEventId/local-sport/:localSportId/summary')
  @Public()
  getSummary(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId',    ParseIntPipe) localSportId:    number,
  ) {
    return this.service.getMedalSummary(externalEventId, localSportId);
  }

  // GET /taekwondo-kyorugui-medal-table/external/223/local-sport/7/institution/45/detail
  @Get('external/:externalEventId/local-sport/:localSportId/institution/:institutionId/detail')
  @Public()
  getInstitutionDetail(
    @Param('externalEventId', ParseIntPipe) externalEventId: number,
    @Param('localSportId', ParseIntPipe) localSportId: number,
    @Param('institutionId', ParseIntPipe) institutionId: number,
  ) {
    return this.service.getMedalDetailByInstitution(
      externalEventId,
      localSportId,
      institutionId,
    );
  }
}