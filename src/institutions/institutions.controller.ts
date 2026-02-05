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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express'; 
import { InstitutionsService } from './institutions.service';
import {
  CreateInstitutionDto,
  UpdateInstitutionDto,
  CreateAthleteDto,
  UpdateAthleteDto,
  CreateTeamDto,
  UpdateTeamDto,
  AddTeamMemberDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UploadService, multerConfig } from '../common/services/upload.service'; 

@Controller('institutions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstitutionsController {
  constructor(
    private readonly institutionsService: InstitutionsService,
    private readonly uploadService: UploadService, 
  ) {}

  // ==================== INSTITUTIONS ====================

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createInstitution(@Body() createDto: CreateInstitutionDto) {
    return this.institutionsService.createInstitution(createDto);
  }

  @Get()
  @Public()
  findAllInstitutions() {
    return this.institutionsService.findAllInstitutions();
  }

  // ==================== ATHLETES (ANTES DE :id) ====================

  @Post('athletes')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createAthlete(@Body() createDto: CreateAthleteDto) {
    return this.institutionsService.createAthlete(createDto);
  }

  @Get('athletes')
  @Public()
  findAllAthletes(@Query('institutionId') institutionId?: string) {
    const institutionIdNum = institutionId
      ? parseInt(institutionId, 10)
      : undefined;
    return this.institutionsService.findAllAthletes(institutionIdNum);
  }

  @Get('athletes/:id')
  @Public()
  findOneAthlete(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.findOneAthlete(id);
  }

  @Patch('athletes/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateAthlete(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAthleteDto,
  ) {
    return this.institutionsService.updateAthlete(id, updateDto);
  }

  @Delete('athletes/:id')
  @Roles(UserRole.ADMIN)
  removeAthlete(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.removeAthlete(id);
  }

  @Post('athletes/:id/upload-photo')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @UseInterceptors(FileInterceptor('file', multerConfig('athletes')))
  async uploadAthletePhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const photoUrl = this.uploadService.getFileUrl(file.filename, 'athletes');

    // Actualizar el atleta con la nueva URL
    await this.institutionsService.updateAthlete(id, { photoUrl });

    return {
      message: 'Foto subida exitosamente',
      photoUrl,
      filename: file.filename,
    };
  }

  // ==================== TEAMS (ANTES DE :id) ====================

  @Post('teams')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createTeam(@Body() createDto: CreateTeamDto) {
    return this.institutionsService.createTeam(createDto);
  }

  @Get('teams')
  @Public()
  findAllTeams(
    @Query('institutionId') institutionId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const institutionIdNum = institutionId
      ? parseInt(institutionId, 10)
      : undefined;
    const categoryIdNum = categoryId ? parseInt(categoryId, 10) : undefined;
    return this.institutionsService.findAllTeams(
      institutionIdNum,
      categoryIdNum,
    );
  }

  @Get('teams/:id')
  @Public()
  findOneTeam(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.findOneTeam(id);
  }

  @Patch('teams/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateTeam(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTeamDto,
  ) {
    return this.institutionsService.updateTeam(id, updateDto);
  }

  @Delete('teams/:id')
  @Roles(UserRole.ADMIN)
  removeTeam(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.removeTeam(id);
  }

  // ==================== TEAM MEMBERS ====================

  @Post('teams/:teamId/members')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  addTeamMember(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.institutionsService.addTeamMember(teamId, dto);
  }

  @Delete('teams/:teamId/members/:athleteId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  removeTeamMember(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('athleteId', ParseIntPipe) athleteId: number,
  ) {
    return this.institutionsService.removeTeamMember(teamId, athleteId);
  }

  @Patch('teams/:teamId/members/:athleteId/role')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateTeamMemberRole(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('athleteId', ParseIntPipe) athleteId: number,
    @Body('rol') rol: string,
  ) {
    return this.institutionsService.updateTeamMemberRole(
      teamId,
      athleteId,
      rol,
    );
  }

  // ==================== INSTITUTIONS BY ID (AL FINAL) ====================

  @Get(':id')
  @Public()
  findOneInstitution(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.findOneInstitution(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateInstitution(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateInstitutionDto,
  ) {
    return this.institutionsService.updateInstitution(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  removeInstitution(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.removeInstitution(id);
  }

  @Post(':id/upload-logo')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @UseInterceptors(FileInterceptor('file', multerConfig('institutions')))
  async uploadInstitutionLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const logoUrl = this.uploadService.getFileUrl(file.filename, 'institutions');

    await this.institutionsService.updateInstitution(id, { logoUrl });

    return {
      message: 'Logo subido exitosamente',
      logoUrl,
      filename: file.filename,
    };
  }
}
