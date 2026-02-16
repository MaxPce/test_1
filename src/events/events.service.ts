import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Event, EventCategory, Registration } from './entities';
import { SismasterService } from '../sismaster/sismaster.service';
import { Athlete } from '../institutions/entities/athlete.entity';
import { Institution } from '../institutions/entities/institution.entity';
import { Gender } from '../common/enums';
import {
  CreateEventDto,
  UpdateEventDto,
  CreateEventCategoryDto,
  UpdateEventCategoryDto,
  CreateRegistrationDto,
  BulkRegisterDto,
  BulkRegisterSismasterDto,
} from './dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(EventCategory)
    private eventCategoryRepository: Repository<EventCategory>,
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    @InjectRepository(Athlete)
    private athleteRepository: Repository<Athlete>,
    @InjectRepository(Institution)
    private institutionRepository: Repository<Institution>,
    private dataSource: DataSource,
    private sismasterService: SismasterService,
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

  // Agregar filtro de eliminados
  async findAllEvents(status?: string): Promise<Event[]> {
    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.eventCategories', 'eventCategories')
      .leftJoinAndSelect('eventCategories.category', 'category')
      .where('event.deletedAt IS NULL');

    if (status) {
      queryBuilder.andWhere('event.status = :status', { status });
    }

    return queryBuilder.orderBy('event.startDate', 'DESC').getMany();
  }

  // Agregar withDeleted: false
  async findOneEvent(id: number): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { eventId: id },
      relations: [
        'eventCategories',
        'eventCategories.category',
        'eventCategories.category.sport',
        'eventCategories.registrations',
      ],
      withDeleted: false,
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

  // Cambiar a soft delete
  async removeEvent(id: number, userId?: number): Promise<void> {
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

    // SOFT DELETE
    await this.eventRepository.softRemove(event);

    // Actualizar deletedBy
    if (userId) {
      await this.eventRepository.update(id, { deletedBy: userId });
    }
  }

  // Restaurar evento eliminado
  async restoreEvent(id: number): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { eventId: id },
      withDeleted: true,
    });

    if (!event) {
      throw new NotFoundException(`Evento con ID ${id} no encontrado`);
    }

    if (!event.deletedAt) {
      throw new BadRequestException('El evento no está eliminado');
    }

    await this.eventRepository.restore(id);
    await this.eventRepository
      .createQueryBuilder()
      .update()
      .set({ deletedBy: null } as any)
      .where('eventId = :id', { id })
      .execute();

    return this.findOneEvent(id);
  }

  // Listar eventos eliminados
  async findDeletedEvents(): Promise<Event[]> {
    return this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.eventCategories', 'eventCategories')
      .leftJoinAndSelect('eventCategories.category', 'category')
      .where('event.deletedAt IS NOT NULL')
      .withDeleted()
      .getMany();
  }

  // Eliminar permanentemente
  async hardDeleteEvent(id: number): Promise<void> {
    const event = await this.eventRepository.findOne({
      where: { eventId: id },
      withDeleted: true,
    });

    if (!event) {
      throw new NotFoundException(`Evento con ID ${id} no encontrado`);
    }

    await this.eventRepository.remove(event);
  }

  // ==================== EVENT CATEGORIES ====================

  async createEventCategory(
    createDto: CreateEventCategoryDto,
  ): Promise<EventCategory> {
    if (!createDto.eventId && !createDto.externalEventId) {
      throw new BadRequestException(
        'Debe proporcionar eventId (evento local) o externalEventId (evento Sismaster)',
      );
    }

    if (createDto.eventId) {
      await this.findOneEvent(createDto.eventId);
    }

    const whereCondition: any = {
      categoryId: createDto.categoryId,
    };

    if (createDto.eventId) {
      whereCondition.eventId = createDto.eventId;
    } else {
      whereCondition.externalEventId = createDto.externalEventId;
    }

    const existing = await this.eventCategoryRepository.findOne({
      where: whereCondition,
    });

    if (existing) {
      throw new BadRequestException(
        'Esta categoría ya está asociada al evento',
      );
    }

    const eventCategory = this.eventCategoryRepository.create({
      eventId: createDto.eventId ?? null,
      externalEventId: createDto.externalEventId ?? null,
      categoryId: createDto.categoryId,
      externalSportId: createDto.externalSportId ?? null,
      status: createDto.status ?? 'pendiente',
    });

    return await this.eventCategoryRepository.save(eventCategory);
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
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .where('registrations.deletedAt IS NULL');

    if (eventId) {
      queryBuilder.andWhere('eventCategory.eventId = :eventId', { eventId });
    }

    const result = await queryBuilder.getMany();

    return result;
  }

  async findOneEventCategory(id: number): Promise<EventCategory> {
    const eventCategory = await this.eventCategoryRepository.findOne({
      where: {
        eventCategoryId: id,
      },
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
        'registrations.team.members.athlete.institution',
      ],
    });

    if (!eventCategory) {
      throw new NotFoundException(
        `Categoría de evento con ID ${id} no encontrada`,
      );
    }

    // Filtrar registrations eliminados manualmente
    if (eventCategory.registrations) {
      eventCategory.registrations = eventCategory.registrations.filter(
        (reg) => !reg.deletedAt,
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

  // Agregar filtro de eliminados
  async findAllRegistrations(
    eventCategoryId?: number,
  ): Promise<Registration[]> {
    const queryBuilder = this.registrationRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.eventCategory', 'eventCategory')
      .leftJoinAndSelect('eventCategory.category', 'category')
      // ✅ Cargar athlete
      .leftJoinAndSelect('registration.athlete', 'athlete')
      // ✅ CRÍTICO: Cargar institution
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      // ✅ Para teams
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .leftJoinAndSelect('team.members', 'members')
      .leftJoinAndSelect('members.athlete', 'memberAthlete')
      .where('registration.deletedAt IS NULL');

    if (eventCategoryId) {
      queryBuilder.andWhere('registration.eventCategoryId = :eventCategoryId', {
        eventCategoryId,
      });
    }

    return queryBuilder.orderBy('registration.seedNumber', 'ASC').getMany();
  }

  // Agregar withDeleted: false
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
      withDeleted: false,
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

  // Cambiar a soft delete
  async removeRegistration(id: number, userId?: number): Promise<void> {
    const registration = await this.findOneRegistration(id);

    // SOFT DELETE
    await this.registrationRepository.softRemove(registration);

    if (userId) {
      await this.registrationRepository.update(id, { deletedBy: userId });
    }
  }

  // Restaurar registro eliminado
  async restoreRegistration(id: number): Promise<Registration> {
    const registration = await this.registrationRepository.findOne({
      where: { registrationId: id },
      withDeleted: true,
    });

    if (!registration) {
      throw new NotFoundException(`Registro con ID ${id} no encontrado`);
    }

    if (!registration.deletedAt) {
      throw new BadRequestException('El registro no está eliminado');
    }

    await this.registrationRepository.restore(id);
    await this.registrationRepository
      .createQueryBuilder()
      .update()
      .set({ deletedBy: null } as any)
      .where('registrationId = :id', { id })
      .execute();

    return this.findOneRegistration(id);
  }

  // Listar registros eliminados
  async findDeletedRegistrations(): Promise<Registration[]> {
    return this.registrationRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.eventCategory', 'eventCategory')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('registration.team', 'team')
      .where('registration.deletedAt IS NOT NULL')
      .withDeleted()
      .getMany();
  }

  // Eliminar registro permanentemente
  async hardDeleteRegistration(id: number): Promise<void> {
    const registration = await this.registrationRepository.findOne({
      where: { registrationId: id },
      withDeleted: true,
    });

    if (!registration) {
      throw new NotFoundException(`Registro con ID ${id} no encontrado`);
    }

    await this.registrationRepository.remove(registration);
  }
  // ==================== SISMASTER INTEGRATION ====================

  /**
   * Sincronizar atletas acreditados desde Sismaster
   */
  async syncAthletesFromSismaster(
    eventCategoryId: number,
    externalEventId: number,
    externalSportId?: number,
  ) {
    // 1. Verificar que la event_category exista
    const eventCategory = await this.eventCategoryRepository.findOne({
      where: { eventCategoryId },
      relations: ['category'],
    });

    if (!eventCategory) {
      throw new NotFoundException(
        `EventCategory ${eventCategoryId} no encontrada`,
      );
    }

    // 2. Actualizar referencias externas
    eventCategory.externalEventId = externalEventId;
    if (externalSportId) {
      eventCategory.externalSportId = externalSportId;
    }
    await this.eventCategoryRepository.save(eventCategory);

    // 3. Obtener TODOS los atletas acreditados del evento
    const accreditedAthletes =
      await this.sismasterService.getAccreditedAthletes({
        idevent: externalEventId,
      });

    const syncResults = {
      total: accreditedAthletes.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ athlete: string; error: string }>,
    };

    // 4. Sincronizar cada atleta
    for (const externalAthlete of accreditedAthletes) {
      try {
        // 4.1. Buscar o crear atleta local
        let localAthlete = await this.athleteRepository.findOne({
          where: { docNumber: externalAthlete.docnumber },
        });

        // 4.2. Buscar o crear institución local
        let localInstitution = await this.institutionRepository.findOne({
          where: { abrev: externalAthlete.institutionAbrev },
        });

        if (!localInstitution) {
          // Crear institución si no existe
          localInstitution = this.institutionRepository.create({
            name: externalAthlete.institutionName,
            abrev: externalAthlete.institutionAbrev,
            logoUrl: externalAthlete.institutionLogo,
          });
          localInstitution =
            await this.institutionRepository.save(localInstitution);
        }

        if (!localAthlete) {
          // Crear atleta si no existe
          localAthlete = this.athleteRepository.create({
            institutionId: localInstitution.institutionId,
            name: externalAthlete.fullName,
            dateBirth: externalAthlete.birthday,
            gender:
              externalAthlete.gender === 'M'
                ? Gender.MASCULINO
                : Gender.FEMENINO,
            nationality: externalAthlete.country || 'PER',
            docNumber: externalAthlete.docnumber,
            photoUrl: externalAthlete.photo,
          });
          localAthlete = await this.athleteRepository.save(localAthlete);
          syncResults.created++;
        } else {
          // Actualizar datos del atleta si ya existe
          localAthlete.name = externalAthlete.fullName;
          localAthlete.dateBirth = externalAthlete.birthday;
          localAthlete.gender =
            externalAthlete.gender === 'M' ? Gender.MASCULINO : Gender.FEMENINO;
          localAthlete.institutionId = localInstitution.institutionId;
          await this.athleteRepository.save(localAthlete);
          syncResults.updated++;
        }

        // 4.3. Verificar si ya está registrado en este eventCategory
        const existingRegistration = await this.registrationRepository.findOne({
          where: {
            eventCategoryId: eventCategory.eventCategoryId,
            athleteId: localAthlete.athleteId,
          },
        });

        if (!existingRegistration) {
          // Crear registration
          const registration = this.registrationRepository.create({
            eventCategoryId: eventCategory.eventCategoryId,
            athleteId: localAthlete.athleteId,
            externalAthleteId: externalAthlete.idperson,
            externalInstitutionId: externalAthlete.idinstitution,
            externalAccreditationId: externalAthlete.idacreditation,
          });
          await this.registrationRepository.save(registration);
        } else {
          // Actualizar referencias externas si ya existe
          existingRegistration.externalAthleteId = externalAthlete.idperson;
          existingRegistration.externalInstitutionId =
            externalAthlete.idinstitution;
          existingRegistration.externalAccreditationId =
            externalAthlete.idacreditation;
          await this.registrationRepository.save(existingRegistration);
          syncResults.skipped++;
        }
      } catch (error) {
        syncResults.errors.push({
          athlete: externalAthlete.fullName,
          error: error.message || String(error),
        });
      }
    }

    return syncResults;
  }

  /**
   * Obtener atletas de Sismaster para un eventCategory
   */
  async getAvailableAthletesFromSismaster(eventCategoryId: number) {
    const eventCategory = await this.eventCategoryRepository.findOne({
      where: { eventCategoryId },
      relations: ['category'],
    });

    if (!eventCategory) {
      throw new NotFoundException(
        `EventCategory ${eventCategoryId} no encontrada`,
      );
    }

    if (!eventCategory.externalEventId) {
      throw new BadRequestException(
        'Este EventCategory no tiene un evento de Sismaster configurado',
      );
    }

    // Solo filtrar por evento (opcionalmente por género de la categoría)
    return await this.sismasterService.getAccreditedAthletes({
      idevent: eventCategory.externalEventId,
      gender:
        eventCategory.category?.gender !== 'MIXTO'
          ? (eventCategory.category?.gender as 'M' | 'F')
          : undefined,
    });
  }
  /**
   * Obtener registrations por eventId
   */
  async getRegistrationsByEvent(eventId: number): Promise<Registration[]> {
    return this.registrationRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.eventCategory', 'eventCategory')
      .leftJoinAndSelect('eventCategory.category', 'category')
      .leftJoinAndSelect('eventCategory.event', 'event')
      .where('event.eventId = :eventId', { eventId })
      .andWhere('registration.deletedAt IS NULL')
      .orderBy('registration.seedNumber', 'ASC')
      .getMany();
  }
  /**
   * Obtener categorías asignadas a un evento de Sismaster
   */
  async findEventCategoriesByExternalEventId(
    externalEventId: number,
  ): Promise<EventCategory[]> {
    // ✅ SOLUCIÓN: Usar QueryBuilder con todas las relaciones
    const result = await this.eventCategoryRepository
      .createQueryBuilder('eventCategory')
      .leftJoinAndSelect('eventCategory.event', 'event')
      .leftJoinAndSelect('eventCategory.category', 'category')
      .leftJoinAndSelect('category.sport', 'sport')
      .leftJoinAndSelect('eventCategory.registrations', 'registrations')
      .leftJoinAndSelect('registrations.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      .leftJoinAndSelect('registrations.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .leftJoinAndSelect('team.members', 'members')
      .leftJoinAndSelect('members.athlete', 'memberAthlete')
      .leftJoinAndSelect(
        'memberAthlete.institution',
        'memberAthleteInstitution',
      )
      .where('eventCategory.externalEventId = :externalEventId', {
        externalEventId,
      })
      .andWhere('registrations.deletedAt IS NULL')
      .getMany();

    if (
      result.length > 0 &&
      result[0].registrations &&
      result[0].registrations.length > 0
    ) {
      const firstReg = result[0].registrations[0];
      this.logger.log(
        `   Primera registration: AthleteId=${firstReg.athlete?.athleteId}, ` +
          `InstitutionId=${firstReg.athlete?.institutionId}, ` +
          `Institution="${firstReg.athlete?.institution?.name || 'NULL'}"`,
      );
    }

    return result;
  }

  async bulkRegisterFromSismaster(
    bulkDto: BulkRegisterSismasterDto,
  ): Promise<Registration[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const eventCategory = await this.eventCategoryRepository.findOne({
        where: { eventCategoryId: bulkDto.eventCategoryId },
        relations: ['category'],
      });

      if (!eventCategory) {
        throw new NotFoundException(
          `EventCategory ${bulkDto.eventCategoryId} no encontrada`,
        );
      }

      if (!eventCategory.externalEventId) {
        throw new BadRequestException(
          'EventCategory no tiene externalEventId configurado',
        );
      }

      const registrationIds: number[] = [];
      const errors: string[] = [];

      for (const externalAthleteId of bulkDto.external_athlete_ids) {
        try {
          const accreditedAthletes =
            await this.sismasterService.getAccreditedAthletes({
              idevent: eventCategory.externalEventId,
            });

          const sismasterAthlete = accreditedAthletes.find(
            (a) => a.idperson === externalAthleteId,
          );

          if (!sismasterAthlete) {
            errors.push(
              `Atleta ${externalAthleteId} no encontrado en Sismaster`,
            );
            continue;
          }

          let localInstitution = await this.institutionRepository.findOne({
            where: { abrev: sismasterAthlete.institutionAbrev },
          });

          if (!localInstitution) {
            localInstitution = this.institutionRepository.create({
              name: sismasterAthlete.institutionName,
              abrev: sismasterAthlete.institutionAbrev,
              logoUrl: sismasterAthlete.institutionLogo,
            });
            localInstitution = await queryRunner.manager.save(localInstitution);
          }

          let localAthlete = await this.athleteRepository.findOne({
            where: { docNumber: sismasterAthlete.docnumber },
          });

          if (!localAthlete) {
            localAthlete = this.athleteRepository.create({
              name: `${sismasterAthlete.firstname} ${sismasterAthlete.lastname || ''}`.trim(),
              dateBirth: sismasterAthlete.birthday,
              gender:
                sismasterAthlete.gender === 'M'
                  ? Gender.MASCULINO
                  : Gender.FEMENINO,
              nationality: sismasterAthlete.country || 'PER',
              docNumber: sismasterAthlete.docnumber,
              photoUrl: sismasterAthlete.photo || null,
              institutionId: localInstitution.institutionId,
            });
            localAthlete = await queryRunner.manager.save(localAthlete);
          } else {
            localAthlete.institutionId = localInstitution.institutionId;
            if (sismasterAthlete.photo) {
              localAthlete.photoUrl = sismasterAthlete.photo;
            }
            await queryRunner.manager.save(localAthlete);
          }

          const existingRegistration =
            await this.registrationRepository.findOne({
              where: {
                eventCategoryId: bulkDto.eventCategoryId,
                athleteId: localAthlete.athleteId,
              },
            });

          if (existingRegistration) {
            existingRegistration.externalAthleteId = externalAthleteId;
            existingRegistration.externalInstitutionId =
              sismasterAthlete.idinstitution;
            await queryRunner.manager.save(existingRegistration);
            registrationIds.push(existingRegistration.registrationId);
            continue;
          }

          const registration = this.registrationRepository.create({
            eventCategoryId: bulkDto.eventCategoryId,
            athleteId: localAthlete.athleteId,
            externalAthleteId: externalAthleteId,
            externalInstitutionId: sismasterAthlete.idinstitution,
          });

          const saved = await queryRunner.manager.save(registration);
          registrationIds.push(saved.registrationId);
        } catch (error) {
          errors.push(
            `Error con atleta ${externalAthleteId}: ${error.message}`,
          );
        }
      }

      await queryRunner.commitTransaction();

      if (errors.length > 0) {
        this.logger.warn(`Errores en inscripción masiva: ${errors.join(', ')}`);
      }

      if (registrationIds.length === 0) {
        this.logger.warn('⚠️ No se crearon registrations');
        return [];
      }

      const fullRegistrations = await this.registrationRepository
        .createQueryBuilder('registration')
        .leftJoinAndSelect('registration.athlete', 'athlete')
        .leftJoinAndSelect('athlete.institution', 'institution')
        .leftJoinAndSelect('registration.eventCategory', 'eventCategory')
        .leftJoinAndSelect('eventCategory.category', 'category')
        .whereInIds(registrationIds)
        .getMany();

      fullRegistrations.forEach((reg, index) => {
        this.logger.log(
          `  [${index + 1}] Registration ${reg.registrationId}: ` +
            `Atleta="${reg.athlete?.name || 'NULL'}", ` +
            `AthleteId=${reg.athlete?.athleteId || 'NULL'}, ` +
            `InstitutionId=${reg.athlete?.institutionId || 'NULL'}, ` +
            `Institution="${reg.athlete?.institution?.name || 'NULL'}"`,
        );
      });

      return fullRegistrations;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error en bulkRegisterFromSismaster: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
