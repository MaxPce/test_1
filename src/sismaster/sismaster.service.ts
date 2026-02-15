import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
import { toSismasterUrl } from './constants/sismaster.constants';

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
      throw new NotFoundException(
        `Evento ${idevent} no encontrado en Sismaster`,
      );
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
      throw new NotFoundException(
        `Deporte ${idsport} no encontrado en Sismaster`,
      );
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
   * Obtener atleta por ID (person)
   */
  async getAthleteById(idperson: number): Promise<SismasterPerson | null> {
    if (!idperson) return null;

    try {
      const person = await this.personRepo.findOne({
        where: { idperson, mstatus: 1 },
        select: [
          'idperson',
          'firstname',
          'lastname',
          'surname',
          'docnumber',
          'gender',
          'birthday',
          'country',
        ],
      });

      return person || null;
    } catch (error) {
      this.logger.error(`Error fetching person ${idperson}:`, error);
      return null;
    }
  }

  /**
   * Obtener atleta por documento
   */
  async getAthleteByDocument(docnumber: string) {
    const person = await this.personRepo.findOne({ where: { docnumber } });
    if (!person) {
      throw new NotFoundException(
        `Atleta con documento ${docnumber} no encontrado`,
      );
    }
    return person;
  }

  async getAccreditedAthletes(
    filters: AccreditationFilters,
  ): Promise<AthleteSismasterDto[]> {
    this.logger.log(`Consultando acreditaciones: ${JSON.stringify(filters)}`);

    const query = this.accreditationRepo
      .createQueryBuilder('a')
      .innerJoin('person', 'p', 'a.idperson = p.idperson')
      .innerJoin('institution', 'i', 'a.idinstitution = i.idinstitution')
      .select([
        'p.idperson AS idperson',
        'p.docnumber AS docnumber',
        'p.firstname AS firstname',
        'p.lastname AS lastname',
        'p.surname AS surname',
        'p.gender AS gender',
        'p.birthday AS birthday',
        'p.country AS country',
        'MAX(a.photo) AS photo',
        'MAX(a.idinstitution) AS idinstitution',
        'MAX(a.idevent) AS idevent',
        'MAX(i.business_name) AS institutionName',
        'MAX(i.abrev) AS institutionAbrev',
        'MAX(i.avatar) AS institutionLogo',
      ])
      .where('a.idevent = :idevent', { idevent: filters.idevent })
      .andWhere('a.mstatus = 1')
      .andWhere('p.mstatus = 1')
      .andWhere('a.tregister = :tregister', { tregister: 'D' });

    // Filtros opcionales
    if (filters.idinstitution) {
      query.andWhere('a.idinstitution = :idinstitution', {
        idinstitution: filters.idinstitution,
      });
    }

    if (filters.gender) {
      query.andWhere('p.gender = :gender', { gender: filters.gender });
    }

    query
      .groupBy('p.idperson')
      .addGroupBy('p.docnumber')
      .addGroupBy('p.firstname')
      .addGroupBy('p.lastname')
      .addGroupBy('p.surname')
      .addGroupBy('p.gender')
      .addGroupBy('p.birthday')
      .addGroupBy('p.country')
      .orderBy('p.lastname', 'ASC')
      .addOrderBy('p.firstname', 'ASC');

    const results = await query.getRawMany();

    // Transformar y calcular campos adicionales
    return results.map((row) => ({
      ...row,
      photo: toSismasterUrl(row.photo),
      institutionLogo: toSismasterUrl(row.institutionLogo),
      fullName:
        `${row.firstname} ${row.lastname || ''} ${row.surname || ''}`.trim(),
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
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }

  /**
   * Buscar atletas ACREDITADOS por nombre o documento
   * Devuelve datos completos con foto e institución
   */
  async searchAthletesByName(
    searchTerm: string,
    limit: number = 50,
  ): Promise<AthleteSismasterDto[]> {
    // Usar subquery para obtener la primera acreditación de cada persona
    const query = this.accreditationRepo
      .createQueryBuilder('a')
      .innerJoin('person', 'p', 'a.idperson = p.idperson')
      .innerJoin('institution', 'i', 'a.idinstitution = i.idinstitution')
      .select([
        'p.idperson AS idperson',
        'p.docnumber AS docnumber',
        'p.firstname AS firstname',
        'p.lastname AS lastname',
        'p.surname AS surname',
        'p.gender AS gender',
        'p.birthday AS birthday',
        'p.country AS country',
        'MAX(a.photo) AS photo',
        'MAX(a.idinstitution) AS idinstitution',
        'MAX(i.business_name) AS institutionName',
        'MAX(i.abrev) AS institutionAbrev',
        'MAX(i.avatar) AS institutionLogo',
      ])
      .where('a.mstatus = 1')
      .andWhere('p.mstatus = 1')
      .andWhere(
        '(p.firstname LIKE :search OR p.lastname LIKE :search OR p.surname LIKE :search OR p.docnumber LIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .groupBy('p.idperson')
      .addGroupBy('p.docnumber')
      .addGroupBy('p.firstname')
      .addGroupBy('p.lastname')
      .addGroupBy('p.surname')
      .addGroupBy('p.gender')
      .addGroupBy('p.birthday')
      .addGroupBy('p.country')
      .limit(limit);

    const results = await query.getRawMany();

    // Transformar y calcular edad
    return results.map((row) => ({
      ...row,
      photo: toSismasterUrl(row.photo),
      institutionLogo: toSismasterUrl(row.institutionLogo),
      fullName:
        `${row.firstname} ${row.lastname || ''} ${row.surname || ''}`.trim(),
      age: this.calculateAge(row.birthday),
    }));
  }

  /**
   * Obtener persona por ID (optimizado)
   */
  async getPersonById(idperson: number): Promise<SismasterPerson | null> {
    return this.getAthleteById(idperson);
  }

  /**
   * Obtener múltiples personas por IDs (batch loading)
   * Optimizado para evitar N+1 queries
   */
  async getPersonsByIds(ids: number[]): Promise<SismasterPerson[]> {
    if (!ids || ids.length === 0) return [];

    const uniqueIds = [...new Set(ids)].filter((id) => id != null && id > 0);

    if (uniqueIds.length === 0) return [];

    try {
      return await this.personRepo.find({
        where: {
          idperson: In(uniqueIds),
          mstatus: 1,
        },
        select: [
          'idperson',
          'firstname',
          'lastname',
          'surname',
          'docnumber',
          'gender',
          'birthday',
          'country',
        ],
      });
    } catch (error) {
      this.logger.error('Error in batch loading persons:', error);
      return [];
    }
  }

  /**
   * Contar total de atletas ACREDITADOS (únicos)
   */
  async getAthletesCount(): Promise<number> {
    const result = await this.accreditationRepo
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT a.idperson)', 'count')
      .where('a.mstatus = 1')
      .getRawOne();

    return parseInt(result.count, 10) || 0;
  }

  /**
   * Obtener institución por ID (optimizado)
   */
  async getInstitutionById(
    idinstitution: number,
  ): Promise<SismasterInstitution | null> {
    if (!idinstitution) return null;

    try {
      const institution = await this.institutionRepo.findOne({
        where: { idinstitution, mstatus: 1 },
        select: [
          'idinstitution',
          'business',
          'businessName',
          'abrev',
          'avatar',
          'country',
        ],
      });

      return institution || null;
    } catch (error) {
      this.logger.error(`Error fetching institution ${idinstitution}:`, error);
      return null;
    }
  }

  /**
   * Obtener múltiples instituciones por IDs
   */
  async getInstitutionsByIds(ids: number[]): Promise<SismasterInstitution[]> {
    if (!ids || ids.length === 0) return [];

    const uniqueIds = [...new Set(ids)].filter((id) => id != null && id > 0);

    if (uniqueIds.length === 0) return [];

    try {
      return await this.institutionRepo.find({
        where: {
          idinstitution: In(uniqueIds),
          mstatus: 1,
        },
        select: [
          'idinstitution',
          'business',
          'businessName',
          'abrev',
          'avatar',
          'country',
        ],
      });
    } catch (error) {
      this.logger.error('Error in batch loading institutions:', error);
      return [];
    }
  }

  /**
   * Listar todas las instituciones
   */
  async getAllInstitutions() {
    const institutions = await this.institutionRepo.find({
      where: { mstatus: 1 },
      select: [
        'idinstitution',
        'business',
        'businessName',
        'abrev',
        'avatar',
        'country',
      ],
      order: { business: 'ASC' },
    });

    return institutions.map((inst) => ({
      ...inst,
      avatar: toSismasterUrl(inst.avatar),
    }));
  }
}
