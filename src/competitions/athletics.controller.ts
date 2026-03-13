import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AthleticsService } from './athletics.service';
import { CreateAthleticsResultDto } from './dto/create-athletics-result.dto';
import { UpdateAthleticsResultDto } from './dto/update-athletics-result.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AthleticsController {
  constructor(private readonly athleticsService: AthleticsService) {}

  // POST /competitions/athletics
  @Post('athletics')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  create(@Body() dto: CreateAthleticsResultDto) {
    return this.athleticsService.create(dto);
  }

  // GET /competitions/phases/:phaseId/athletics-table
  @Get('phases/:phaseId/athletics-table')
  @Public()
  findByPhase(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.athleticsService.findByPhase(phaseId);
  }

  // GET /competitions/phases/:phaseId/athletics-ranking/track?section=A
  @Get('phases/:phaseId/athletics-ranking/track')
  @Public()
  getRankingTrack(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Query('section') section?: string,
  ) {
    return this.athleticsService.getRankingTrack(phaseId, section);
  }

  // GET /competitions/phases/:phaseId/athletics-ranking/field
  @Get('phases/:phaseId/athletics-ranking/field')
  @Public()
  getRankingField(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.athleticsService.getRankingField(phaseId);
  }

  // GET /competitions/phase-registrations/:id/athletics
  @Get('phase-registrations/:id/athletics')
  @Public()
  findByPhaseRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.findByPhaseRegistration(id);
  }

  // GET /competitions/athletics/:id
  @Get('athletics/:id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.findOne(id);
  }

  // PATCH /competitions/athletics/:id
  @Patch('athletics/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAthleticsResultDto,
  ) {
    return this.athleticsService.update(id, dto);
  }

  // DELETE /competitions/athletics/:id
  @Delete('athletics/:id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.remove(id);
  }

  // DELETE /competitions/phase-registrations/:id/athletics/reset
  @Delete('phase-registrations/:id/athletics/reset')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  reset(@Param('id', ParseIntPipe) id: number) {
    return this.athleticsService.resetPhaseRegistration(id);
  }
}
