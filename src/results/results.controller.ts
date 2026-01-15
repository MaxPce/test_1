// src/results/results.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import {
  CreateResultDto,
  UpdateResultDto,
  CreateAttemptDto,
  PublishMatchResultDto,
  UpdateLiveScoreDto,
  CreateTimeResultDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

@Controller('results')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  // ==================== RESULTS ====================

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createResult(
    @Body() createDto: CreateResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resultsService.createResult(createDto, user.userId);
  }

  @Get()
  @Public()
  findAllResults(@Query('participationId') participationId?: string) {
    const participationIdNum = participationId
      ? parseInt(participationId, 10)
      : undefined;
    return this.resultsService.findAllResults(participationIdNum);
  }

  @Get(':id')
  @Public()
  findOneResult(@Param('id', ParseIntPipe) id: number) {
    return this.resultsService.findOneResult(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateResult(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resultsService.updateResult(id, updateDto, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  removeResult(@Param('id', ParseIntPipe) id: number) {
    return this.resultsService.removeResult(id);
  }

  // ==================== ATTEMPTS ====================

  @Post('attempts')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createAttempt(@Body() createDto: CreateAttemptDto) {
    return this.resultsService.createAttempt(createDto);
  }

  @Get('participations/:participationId/attempts')
  @Public()
  findAttemptsByParticipation(
    @Param('participationId', ParseIntPipe) participationId: number,
  ) {
    return this.resultsService.findAttemptsByParticipation(participationId);
  }

  @Patch('attempts/:id/validity')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateAttemptValidity(
    @Param('id', ParseIntPipe) id: number,
    @Body('isValid') isValid: boolean,
  ) {
    return this.resultsService.updateAttempt(id, isValid);
  }

  @Delete('attempts/:id')
  @Roles(UserRole.ADMIN)
  removeAttempt(@Param('id', ParseIntPipe) id: number) {
    return this.resultsService.removeAttempt(id);
  }

  // ==================== PUBLISH RESULTS ====================

  @Post('publish')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  publishMatchResult(
    @Body() dto: PublishMatchResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resultsService.publishMatchResult(dto, user.userId);
  }

  @Post('live-score')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateLiveScore(
    @Body() dto: UpdateLiveScoreDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resultsService.updateLiveScore(dto, user.userId);
  }

  // ==================== VIEW MATCH RESULTS ====================

  @Get('matches/:matchId')
  @Public()
  getMatchResults(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.resultsService.getMatchResults(matchId);
  }

  // ==================== SWIMMING TIME RESULTS ====================

  @Post('time')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async createTimeResult(
    @Body() dto: CreateTimeResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return await this.resultsService.createTimeResult(dto, user.userId);
  }

  @Get('swimming/:eventCategoryId')
  @Public()
  async getSwimmingResults(
    @Param('eventCategoryId', ParseIntPipe) eventCategoryId: number,
  ) {
    return await this.resultsService.getSwimmingResults(eventCategoryId);
  }

  @Post('swimming/:eventCategoryId/recalculate')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async recalculatePositions(
    @Param('eventCategoryId', ParseIntPipe) eventCategoryId: number,
  ) {
    return await this.resultsService.recalculateSwimmingPositions(
      eventCategoryId,
    );
  }
}
