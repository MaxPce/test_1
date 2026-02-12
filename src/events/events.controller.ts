import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import {
  CreateEventDto,
  UpdateEventDto,
  CreateEventCategoryDto,
  UpdateEventCategoryDto,
  CreateRegistrationDto,
  BulkRegisterDto,
} from './dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { UploadService, multerConfig } from '../common/services/upload.service';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly uploadService: UploadService,
  ) {}

  // ==================== EVENTS ====================

  @Post()
  @Roles(UserRole.ADMIN)
  createEvent(@Body() createDto: CreateEventDto) {
    return this.eventsService.createEvent(createDto);
  }

  @Get()
  @Public()
  findAllEvents(@Query('status') status?: string) {
    return this.eventsService.findAllEvents(status);
  }

  @Get('deleted')
  @Roles(UserRole.ADMIN)
  findDeletedEvents() {
    return this.eventsService.findDeletedEvents();
  }

  // ==================== EVENT CATEGORIES ====================

  @Post('categories')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createEventCategory(@Body() createDto: CreateEventCategoryDto) {
    return this.eventsService.createEventCategory(createDto);
  }

  @Get('categories')
  @Public()
  findAllEventCategories(@Query('eventId') eventId?: string) {
    const eventIdNum = eventId ? parseInt(eventId, 10) : undefined;
    return this.eventsService.findAllEventCategories(eventIdNum);
  }

  @Get('categories/:id')
  @Public()
  findOneEventCategory(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.findOneEventCategory(id);
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateEventCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateEventCategoryDto,
  ) {
    return this.eventsService.updateEventCategory(id, updateDto);
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN)
  removeEventCategory(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.removeEventCategory(id);
  }

  // ==================== REGISTRATIONS ====================

  @Post('registrations')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createRegistration(@Body() createDto: CreateRegistrationDto) {
    return this.eventsService.createRegistration(createDto);
  }

  @Post('registrations/bulk')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  bulkRegister(@Body() bulkDto: BulkRegisterDto) {
    return this.eventsService.bulkRegister(bulkDto);
  }

  @Get('registrations')
  @Public()
  findAllRegistrations(@Query('eventCategoryId') eventCategoryId?: string) {
    const eventCategoryIdNum = eventCategoryId
      ? parseInt(eventCategoryId, 10)
      : undefined;
    return this.eventsService.findAllRegistrations(eventCategoryIdNum);
  }

  @Get('registrations/deleted')
  @Roles(UserRole.ADMIN)
  findDeletedRegistrations() {
    return this.eventsService.findDeletedRegistrations();
  }

  @Get('registrations/:id')
  @Public()
  findOneRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.findOneRegistration(id);
  }

  @Patch('registrations/:id/seed')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateRegistrationSeed(
    @Param('id', ParseIntPipe) id: number,
    @Body('seedNumber', ParseIntPipe) seedNumber: number,
  ) {
    return this.eventsService.updateRegistration(id, seedNumber);
  }

  @Delete('registrations/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async removeRegistration(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    await this.eventsService.removeRegistration(id, user.userId);
    return { message: 'Registro eliminado correctamente' };
  }

  @Patch('registrations/:id/restore')
  @Roles(UserRole.ADMIN)
  restoreRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.restoreRegistration(id);
  }

  @Delete('registrations/:id/hard')
  @Roles(UserRole.ADMIN)
  async hardDeleteRegistration(@Param('id', ParseIntPipe) id: number) {
    await this.eventsService.hardDeleteRegistration(id);
    return { message: 'Registro eliminado permanentemente' };
  }

  // ==================== EVENTS BY ID ====================

  @Get(':id')
  @Public()
  findOneEvent(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.findOneEvent(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async removeEvent(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    await this.eventsService.removeEvent(id, user.userId);
    return { message: 'Evento eliminado correctamente' };
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN)
  restoreEvent(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.restoreEvent(id);
  }

  @Delete(':id/hard')
  @Roles(UserRole.ADMIN)
  async hardDeleteEvent(@Param('id', ParseIntPipe) id: number) {
    await this.eventsService.hardDeleteEvent(id);
    return { message: 'Evento eliminado permanentemente' };
  }

  @Post(':id/upload-logo')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @UseInterceptors(FileInterceptor('file', multerConfig('events')))
  async uploadEventLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const logoUrl = this.uploadService.getFileUrl(file.filename, 'events');

    await this.eventsService.updateEvent(id, { logoUrl });

    return {
      message: 'Logo subido exitosamente',
      logoUrl,
      filename: file.filename,
    };
  }
  // ==================== SISMASTER INTEGRATION ====================

  /**
   * POST /events/categories/:id/sync-sismaster
   * Sincronizar atletas desde Sismaster
   */
  @Post('categories/:id/sync-sismaster')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async syncFromSismaster(
    @Param('id', ParseIntPipe) eventCategoryId: number,
    @Query('externalEventId', ParseIntPipe) externalEventId: number,
    @Query('externalSportId', ParseIntPipe) externalSportId: number,
  ) {
    return await this.eventsService.syncAthletesFromSismaster(
      eventCategoryId,
      externalEventId,
      externalSportId,
    );
  }

  /**
   * GET /events/categories/:id/available-athletes-sismaster
   * Ver atletas disponibles en Sismaster para sincronizar
   */
  @Get('categories/:id/available-athletes-sismaster')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getAvailableAthletes(@Param('id', ParseIntPipe) eventCategoryId: number) {
    return await this.eventsService.getAvailableAthletesFromSismaster(eventCategoryId);
  }
}

