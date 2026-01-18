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
import { UserRole } from '../common/enums/user-role.enum';
import { UploadService, multerConfig } from '../common/services/upload.service';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService, private readonly uploadService: UploadService,) {}

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

  // ==================== EVENT CATEGORIES (ANTES DE :id) ====================

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

  // ==================== REGISTRATIONS (ANTES DE :id) ====================

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
  removeRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.removeRegistration(id);
  }

  // ==================== EVENTS BY ID (AL FINAL) ====================

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
  removeEvent(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.removeEvent(id);
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

    // Actualizar el evento con la nueva URL
    await this.eventsService.updateEvent(id, { logoUrl });

    return {
      message: 'Logo subido exitosamente',
      logoUrl,
      filename: file.filename,
    };
  }
}
