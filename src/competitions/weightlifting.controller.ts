import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { WeightliftingService } from './weightlifting.service';
import { UpsertWeightliftingAttemptDto } from './dto/create-weightlifting-attempt.dto';
import { InitializeWeightliftingPhaseDto } from './dto/initialize-weightlifting-phase.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';


@Controller('competitions/weightlifting')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeightliftingController {
  constructor(private readonly weightliftingService: WeightliftingService) {}


  // GET /competitions/weightlifting/phases/:phaseId/results
  @Get('phases/:phaseId/results')
  @Public()
  async getPhaseResults(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.weightliftingService.getPhaseResults(phaseId);
  }


  // GET /competitions/weightlifting/participations/:participationId/attempts
  @Get('participations/:participationId/attempts')
  @Public()
  async getAttempts(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return this.weightliftingService.getParticipationAttempts(participationId);
  }


  // PUT /competitions/weightlifting/participations/:participationId/attempt
  @Put('participations/:participationId/attempt')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async upsertAttempt(
    @Param('participationId', ParseIntPipe) participationId: number,
    @Body() dto: UpsertWeightliftingAttemptDto,
  ) {
    return this.weightliftingService.upsertAttempt(participationId, dto);
  }


  // POST /competitions/weightlifting/phases/:phaseId/initialize
  @Post('phases/:phaseId/initialize')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async initializePhase(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() dto: InitializeWeightliftingPhaseDto,
  ) {
    return this.weightliftingService.initializePhase(phaseId, dto.entries);
  }
}
