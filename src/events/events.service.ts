// src/events/events.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Event, EventCategory, Registration } from './entities';
import {
  CreateEventDto,
  UpdateEventDto,
  CreateEventCategoryDto,
  UpdateEventCategoryDto,
  CreateRegistrationDto,
  BulkRegisterDto,
} from './dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(EventCategory)
    private eventCategoryRepository: Repository<EventCategory>,
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    private dataSource: DataSource,
  ) {}

  // ==================== EVENTS ====================

  async createEvent(createDto: CreateEventDto): Promise<Event> {
    // Validar fechas
    if (createDto.startDate && createDto.endDate) {
      const start = new Date(createDto.startDate);
      const end = new Date(createDto.endDate);

      if (start > end) {
        throw new BadRequestException(
          'La fecha de inicio no puede ser posterior a la fecha de fin',
        );
      }
    }

    const event = this.eventRepository.create(createDto);
    return this.eventRepository.save(event);
  }

  async findAllEvents(status?: string): Promise<Event[]> {
    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.eventCategories', 'eventCategories')
      .leftJoinAndSelect('eventCategories.category', 'category');

    if (status) {
      queryBuilder.andWhere('event.status = :status', { status });
    }

    return queryBuilder.orderBy('event.startDate', 'DESC').getMany();
  }

  async findOneEvent(id: number): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { eventId: id },
      relations: [
        'eventCategories',
        'eventCategories.category',
        'eventCategories.category.sport',
        'eventCategories.registrations',
      ],
    });

    if (!event) {
      throw new NotFoundException(`Evento con ID ${id} no encontrado`);
    }

    return event;
  }

  async updateEvent(id: number, updateDto: UpdateEventDto): Promise<Event> {
    const event = await this.findOneEvent(id);

    // Validar fechas si se actualizan
    const newStartDate = updateDto.startDate
      ? new Date(updateDto.startDate)
      : event.startDate;
    const newEndDate = updateDto.endDate
      ? new Date(updateDto.endDate)
      : event.endDate;

    if (newStartDate && newEndDate && newStartDate > newEndDate) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser posterior a la fecha de fin',
      );
    }

    Object.assign(event, updateDto);
    return this.eventRepository.save(event);
  }

  async removeEvent(id: number): Promise<void> {
    const event = await this.findOneEvent(id);

    // Verificar si tiene categorías asociadas
    const categoriesCount = await this.eventCategoryRepository.count({
      where: { eventId: id },
    });

    if (categoriesCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el evento porque tiene ${categoriesCount} categoría(s) asociada(s)`,
      );
    }

    await this.eventRepository.remove(event);
  }

  // ==================== EVENT CATEGORIES ====================

  async createEventCategory(
    createDto: CreateEventCategoryDto,
  ): Promise<EventCategory> {
    // Verificar que el evento existe
    await this.findOneEvent(createDto.eventId);

    // Verificar que no exista la misma categoría en el evento
    const existing = await this.eventCategoryRepository.findOne({
      where: {
        eventId: createDto.eventId,
        categoryId: createDto.categoryId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Esta categoría ya está asociada al evento',
      );
    }

    const eventCategory = this.eventCategoryRepository.create(createDto);
    return this.eventCategoryRepository.save(eventCategory);
  }

  async findAllEventCategories(eventId?: number): Promise<EventCategory[]> {
    const queryBuilder = this.eventCategoryRepository
      .createQueryBuilder('eventCategory')
      .leftJoinAndSelect('eventCategory.event', 'event')
      .leftJoinAndSelect('eventCategory.category', 'category')
      .leftJoinAndSelect('category.sport', 'sport')
      .leftJoinAndSelect('eventCategory.registrations', 'registrations')
      .leftJoinAndSelect('registrations.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      .leftJoinAndSelect('registrations.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution');

    if (eventId) {
      queryBuilder.andWhere('eventCategory.eventId = :eventId', { eventId });
    }

    return queryBuilder.getMany();
  }

  async findOneEventCategory(id: number): Promise<EventCategory> {
    const eventCategory = await this.eventCategoryRepository.findOne({
      where: { eventCategoryId: id },
      relations: [
        'event',
        'category',
        'category.sport',
        'registrations',
        'registrations.athlete',
        'registrations.athlete.institution',
        'registrations.team',
        'registrations.team.institution',
        'registrations.team.members',
        'registrations.team.members.athlete',
      ],
    });

    if (!eventCategory) {
      throw new NotFoundException(
        `Categoría de evento con ID ${id} no encontrada`,
      );
    }

    return eventCategory;
  }

  async updateEventCategory(
    id: number,
    updateDto: UpdateEventCategoryDto,
  ): Promise<EventCategory> {
    const eventCategory = await this.findOneEventCategory(id);
    Object.assign(eventCategory, updateDto);
    return this.eventCategoryRepository.save(eventCategory);
  }

  async removeEventCategory(id: number): Promise<void> {
    const eventCategory = await this.findOneEventCategory(id);

    // Verificar si tiene registros
    const registrationsCount = await this.registrationRepository.count({
      where: { eventCategoryId: id },
    });

    if (registrationsCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar porque tiene ${registrationsCount} registro(s) asociado(s)`,
      );
    }

    await this.eventCategoryRepository.remove(eventCategory);
  }

  // ==================== REGISTRATIONS ====================

  async createRegistration(
    createDto: CreateRegistrationDto,
  ): Promise<Registration> {
    // Validar que sea atleta O equipo (no ambos, no ninguno)
    if (
      (!createDto.athleteId && !createDto.teamId) ||
      (createDto.athleteId && createDto.teamId)
    ) {
      throw new BadRequestException(
        'Debe proporcionar athleteId O teamId (no ambos)',
      );
    }

    // Verificar que la categoría del evento existe
    const eventCategory = await this.findOneEventCategory(
      createDto.eventCategoryId,
    );

    // Verificar que no esté ya registrado
    const where: any = { eventCategoryId: createDto.eventCategoryId };
    if (createDto.athleteId) {
      where.athleteId = createDto.athleteId;
    } else {
      where.teamId = createDto.teamId;
    }

    const existing = await this.registrationRepository.findOne({ where });

    if (existing) {
      throw new BadRequestException(
        'El atleta/equipo ya está registrado en esta categoría',
      );
    }

    // Verificar que el tipo de categoría coincida (individual/equipo)
    if (eventCategory.category.type === 'individual' && !createDto.athleteId) {
      throw new BadRequestException(
        'Esta categoría es individual, debe registrar un atleta',
      );
    }

    if (eventCategory.category.type === 'equipo' && !createDto.teamId) {
      throw new BadRequestException(
        'Esta categoría es por equipos, debe registrar un equipo',
      );
    }

    const registration = this.registrationRepository.create(createDto);
    return this.registrationRepository.save(registration);
  }

  async bulkRegister(bulkDto: BulkRegisterDto): Promise<Registration[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const registrations: Registration[] = [];

      // Registrar atletas
      if (bulkDto.athleteIds && bulkDto.athleteIds.length > 0) {
        for (const athleteId of bulkDto.athleteIds) {
          const registration = this.registrationRepository.create({
            eventCategoryId: bulkDto.eventCategoryId,
            athleteId,
          });
          const saved = await queryRunner.manager.save(registration);
          registrations.push(saved);
        }
      }

      // Registrar equipos
      if (bulkDto.teamIds && bulkDto.teamIds.length > 0) {
        for (const teamId of bulkDto.teamIds) {
          const registration = this.registrationRepository.create({
            eventCategoryId: bulkDto.eventCategoryId,
            teamId,
          });
          const saved = await queryRunner.manager.save(registration);
          registrations.push(saved);
        }
      }

      await queryRunner.commitTransaction();
      return registrations;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllRegistrations(
    eventCategoryId?: number,
  ): Promise<Registration[]> {
    const queryBuilder = this.registrationRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.eventCategory', 'eventCategory')
      .leftJoinAndSelect('eventCategory.category', 'category')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .leftJoinAndSelect('team.members', 'members')
      .leftJoinAndSelect('members.athlete', 'memberAthlete');

    if (eventCategoryId) {
      queryBuilder.andWhere('registration.eventCategoryId = :eventCategoryId', {
        eventCategoryId,
      });
    }

    return queryBuilder.orderBy('registration.seedNumber', 'ASC').getMany();
  }

  async findOneRegistration(id: number): Promise<Registration> {
    const registration = await this.registrationRepository.findOne({
      where: { registrationId: id },
      relations: [
        'eventCategory',
        'eventCategory.category',
        'athlete',
        'athlete.institution',
        'team',
        'team.institution',
        'team.members',
        'team.members.athlete',
      ],
    });

    if (!registration) {
      throw new NotFoundException(`Registro con ID ${id} no encontrado`);
    }

    return registration;
  }

  async updateRegistration(
    id: number,
    seedNumber: number,
  ): Promise<Registration> {
    const registration = await this.findOneRegistration(id);
    registration.seedNumber = seedNumber;
    return this.registrationRepository.save(registration);
  }

  async removeRegistration(id: number): Promise<void> {
    const registration = await this.findOneRegistration(id);
    await this.registrationRepository.remove(registration);
  }
}
