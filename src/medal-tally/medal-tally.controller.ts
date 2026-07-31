import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MedalTallyService } from './medal-tally.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('haymaster/medal-tally')
export class MedalTallyController {
  constructor(private readonly medalTallyService: MedalTallyService) {}

  /**
   * GET /api/haymaster/medal-tally/:eventId
   * Medallero general por institución con detalle por deporte
   * Ejemplo: GET /api/haymaster/medal-tally/9
   */
  @Get(':eventId')
  @Public()
  async getMedalTally(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.medalTallyService.getMedalTally(eventId, 'haymaster');
  }
}