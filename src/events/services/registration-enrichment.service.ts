// src/events/services/registration-enrichment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SismasterCacheService } from '../../sismaster/sismaster-cache.service';
import { Registration } from '../entities/registration.entity';
import {
  RegistrationWithSismasterDto,
  AthleteInfoDto,
  InstitutionInfoDto,
} from '../dto/registration-with-sismaster.dto';

@Injectable()
export class RegistrationEnrichmentService {
  private readonly logger = new Logger(RegistrationEnrichmentService.name);

  constructor(private sismasterCacheService: SismasterCacheService) {}

  /**
   * Enriquecer un solo registration con datos de sismaster
   */
  async enrichRegistration(
    registration: Registration,
    ): Promise<RegistrationWithSismasterDto> {
    const enriched: RegistrationWithSismasterDto = {
        registrationId: registration.registrationId,
        eventCategoryId: registration.eventCategoryId,
        externalAthleteId: registration.externalAthleteId,
        externalInstitutionId: registration.externalInstitutionId,
        seedNumber: registration.seedNumber,
    };

    // Cargar athlete desde sismaster
    if (registration.externalAthleteId) {
        const athlete = await this.sismasterCacheService.getAthleteById(
        registration.externalAthleteId,
        );

        if (athlete) {
        enriched.athlete = this.mapAthleteToDto(athlete);
        } else {
        this.logger.warn(
            `Athlete ${registration.externalAthleteId} not found in sismaster`,
        );
        }
    }

    // Cargar institution desde sismaster
    if (registration.externalInstitutionId) {
        const institution = await this.sismasterCacheService.getInstitutionById(
        registration.externalInstitutionId,
        );

        if (institution) {
        enriched.institution = this.mapInstitutionToDto(institution);
        } else {
        this.logger.warn(
            `Institution ${registration.externalInstitutionId} not found in sismaster`,
        );
        }
    }

    // Cargar datos de category si está disponible
    if (registration.eventCategory) {
        // Verificar si la relación 'category' está cargada
        if (registration.eventCategory.category) {
        enriched.categoryName = registration.eventCategory.category.name;
        }
        
        // Verificar si la relación 'event' está cargada
        if (registration.eventCategory.event) {
        enriched.eventName = registration.eventCategory.event.name;
        }
    }

    return enriched;
    }


  /**
   * Enriquecer múltiples registrations (optimizado con batch loading)
   */
  async enrichRegistrations(
    registrations: Registration[],
    ): Promise<RegistrationWithSismasterDto[]> {
    if (!registrations || registrations.length === 0) return [];

    // 1. Extraer todos los IDs únicos
    const athleteIds = [
        ...new Set(
        registrations
            .map((r) => r.externalAthleteId)
            .filter((id) => id != null),
        ),
    ];

    const institutionIds = [
        ...new Set(
        registrations
            .map((r) => r.externalInstitutionId)
            .filter((id) => id != null),
        ),
    ];

    // 2. Cargar todos los athletes e institutions en batch (1 query cada uno)
    const [athletes, institutions] = await Promise.all([
        this.sismasterCacheService.getAthletesByIds(athleteIds),
        this.sismasterCacheService.getInstitutionsByIds(institutionIds),
    ]);

    // 3. Crear maps para acceso rápido
    const athleteMap = new Map(athletes.map((a) => [a.idperson, a]));
    const institutionMap = new Map(
        institutions.map((i) => [i.idinstitution, i]),
    );

    // 4. Mapear registrations a DTOs enriquecidos
    return registrations.map((registration) => {
        const enriched: RegistrationWithSismasterDto = {
        registrationId: registration.registrationId,
        eventCategoryId: registration.eventCategoryId,
        externalAthleteId: registration.externalAthleteId,
        externalInstitutionId: registration.externalInstitutionId,
        seedNumber: registration.seedNumber,
        };

        // Mapear athlete
        if (registration.externalAthleteId) {
        const athlete = athleteMap.get(registration.externalAthleteId);
        if (athlete) {
            enriched.athlete = this.mapAthleteToDto(athlete);
        }
        }

        // Mapear institution
        if (registration.externalInstitutionId) {
        const institution = institutionMap.get(
            registration.externalInstitutionId,
        );
        if (institution) {
            enriched.institution = this.mapInstitutionToDto(institution);
        }
        }

        // Mapear category info (CORREGIDO)
        if (registration.eventCategory) {
        if (registration.eventCategory.category) {
            enriched.categoryName = registration.eventCategory.category.name;
        }
        
        if (registration.eventCategory.event) {
            enriched.eventName = registration.eventCategory.event.name;
        }
        }

        return enriched;
    });
    }


  /**
   * Mapear SismasterPerson a AthleteInfoDto
   */
  private mapAthleteToDto(athlete: any): AthleteInfoDto {
    return {
      idperson: athlete.idperson,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      surname: athlete.surname,
      fullName: `${athlete.firstname} ${athlete.lastname || ''} ${athlete.surname || ''}`.trim(),
      docnumber: athlete.docnumber,
      gender: athlete.gender,
      birthday: athlete.birthday,
      country: athlete.country,
    };
  }

  /**
   * Mapear SismasterInstitution a InstitutionInfoDto
   */
  private mapInstitutionToDto(institution: any): InstitutionInfoDto {
    return {
      idinstitution: institution.idinstitution,
      business: institution.business,
      businessName: institution.businessName || institution.business,
      abrev: institution.abrev,
      avatar: institution.avatar,
      country: institution.country,
    };
  }
}
