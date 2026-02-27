import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { WeightliftingService } from './weightlifting.service';
import { UpsertWeightliftingAttemptDto } from './dto/create-weightlifting-attempt.dto';

@Controller('competitions/weightlifting')
export class WeightliftingController {
  constructor(private readonly weightliftingService: WeightliftingService) {}

  // GET /competitions/weightlifting/phases/:phaseId/results
  @Get('phases/:phaseId/results')
  async getPhaseResults(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.weightliftingService.getPhaseResults(phaseId);
  }

  // GET /competitions/weightlifting/participations/:participationId/attempts
  @Get('participations/:participationId/attempts')
  async getAttempts(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return this.weightliftingService.getParticipationAttempts(participationId);
  }

  // PUT /competitions/weightlifting/participations/:participationId/attempt
  @Put('participations/:participationId/attempt')
  async upsertAttempt(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() dto: UpsertWeightliftingAttemptDto,
  ) {
    return this.weightliftingService.upsertAttempt(participationId, dto);
  }
}
