// src/sismaster/sismaster.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SismasterEvent,
  SismasterPerson,
  SismasterInstitution,
  SismasterSport,
  SismasterAccreditation,
} from './entities';
import { EventSismasterDto } from './dto/event-sismaster.dto';
import { AthleteSismasterDto } from './dto/athlete-sismaster.dto';
import { AccreditationFilters } from './interfaces/sismaster-filters.interface';

@Injectable()
export class SismasterService {
  private readonly logger = new Logger(SismasterService.name);

  constructor(
    @InjectRepository(SismasterEvent, 'sismaster')
    private readonly eventRepo: Repository<SismasterEvent>,

    @InjectRepository(SismasterPerson, 'sismaster')
    private readonly personRepo: Repository<SismasterPerson>,

    @InjectRepository(SismasterInstitution, 'sismaster')
    private readonly institutionRepo: Repository<SismasterInstitution>,

    @InjectRepository(SismasterSport, 'sismaster')
    private readonly sportRepo: Repository<SismasterSport>,

    @InjectRepository(SismasterAccreditation, 'sismaster')
    private readonly accreditationRepo: Repository<SismasterAccreditation>,
  ) {}

  /**
   * Obtener evento por ID
   */
  async getEventById(idevent: number): Promise<EventSismasterDto> {
    const event = await this.eventRepo.findOne({ where: { idevent } });
    if (!event) {
      throw new NotFoundException(`Evento ${idevent} no encontrado en Sismaster`);
    }
    return event;
  }

  /**
   * Listar todos los eventos
   */
  async getAllEvents(): Promise<EventSismasterDto[]> {
    return await this.eventRepo.find({
        where: { mstatus: 1 },  
        order: { startdate: 'DESC' },
    });
    }


  /**
   * Obtener deporte por ID
   */
  async getSportById(idsport: number) {
    const sport = await this.sportRepo.findOne({ where: { idsport } });
    if (!sport) {
      throw new NotFoundException(`Deporte ${idsport} no encontrado en Sismaster`);
    }
    return sport;
  }

  /**
   * Listar todos los deportes
   */
  async getAllSports() {
    return await this.sportRepo.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * Obtener institución por ID
   */
  async getInstitutionById(idinstitution: number) {
    const institution = await this.institutionRepo.findOne({
      where: { idinstitution },
    });
    if (!institution) {
      throw new NotFoundException(`Institución ${idinstitution} no encontrada en Sismaster`);
    }
    return institution;
  }

  /**
   * Obtener atleta por ID (person)
   */
  async getAthleteById(idperson: number) {
    const person = await this.personRepo.findOne({ where: { idperson } });
    if (!person) {
      throw new NotFoundException(`Atleta ${idperson} no encontrado en Sismaster`);
    }
    return person;
  }

  /**
   * Obtener atleta por documento
   */
  async getAthleteByDocument(docnumber: string) {
    const person = await this.personRepo.findOne({ where: { docnumber } });
    if (!person) {
      throw new NotFoundException(`Atleta con documento ${docnumber} no encontrado`);
    }
    return person;
  }

  /**
   * Obtener acreditaciones con filtros
   */
  async getAccreditedAthletes(
    filters: AccreditationFilters,
    ): Promise<AthleteSismasterDto[]> {
    this.logger.log(`Consultando acreditaciones: ${JSON.stringify(filters)}`);

    // Query builder para JOIN completo
    const query = this.accreditationRepo
        .createQueryBuilder('a')
        .innerJoin('person', 'p', 'a.idperson = p.idperson')
        .innerJoin('institution', 'i', 'a.idinstitution = i.idinstitution')
        .select([
        'a.idacreditation AS idacreditation',
        'a.idevent AS idevent',
        'a.idsport AS idsport',
        'a.idinstitution AS idinstitution',
        'a.photo AS photo',
        'p.idperson AS idperson',
        'p.docnumber AS docnumber',
        'p.firstname AS firstname',
        'p.lastname AS lastname',
        'p.surname AS surname',
        'p.gender AS gender',
        'p.birthday AS birthday',
        'p.country AS country',
        'i.business_name AS institutionName',
        'i.abrev AS institutionAbrev',
        'i.avatar AS institutionLogo',
        ])
        .where('a.idevent = :idevent', { idevent: filters.idevent })
        .andWhere('a.idsport = :idsport', { idsport: filters.idsport })
        .andWhere('a.mstatus = 1') 
        .andWhere('p.mstatus = 1'); 

    // Filtros opcionales
    if (filters.tregister) {
        query.andWhere('a.tregister = :tregister', { tregister: filters.tregister });
    }

    if (filters.idinstitution) {
        query.andWhere('a.idinstitution = :idinstitution', {
        idinstitution: filters.idinstitution,
        });
    }

    if (filters.gender) {
        query.andWhere('p.gender = :gender', { gender: filters.gender });
    }

    const results = await query.getRawMany();

    // Transformar y calcular campos adicionales
    return results.map((row) => ({
        ...row,
        fullName: `${row.firstname} ${row.lastname || ''} ${row.surname || ''}`.trim(),
        age: this.calculateAge(row.birthday),
    }));
}

  /**
   * Calcular edad
   */
  private calculateAge(birthday: Date): number | null {
    if (!birthday) return null;
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Buscar atletas por nombre (útil para búsquedas)
   */
  async searchAthletesByName(searchTerm: string, limit: number = 20) {
    return await this.personRepo
      .createQueryBuilder('p')
      .where('p.firstname LIKE :search', { search: `%${searchTerm}%` })
      .orWhere('p.lastname LIKE :search', { search: `%${searchTerm}%` })
      .orWhere('p.surname LIKE :search', { search: `%${searchTerm}%` })
      .orWhere('p.docnumber LIKE :search', { search: `%${searchTerm}%` })
      .limit(limit)
      .getMany();
  }
}
