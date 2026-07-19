import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  SismasterEvent,
  SismasterPerson,
  SismasterInstitution,
  SismasterSport,
  SismasterAccreditation,
  SismasterEventSport,
  SismasterSportParam,
} from '../sismaster/entities';
import { EventSismasterDto } from '../sismaster/dto/event-sismaster.dto';
import { HaymasterEvent } from './entities/haymaster-event.entity';
import { AthleteSismasterDto } from '../sismaster/dto/athlete-sismaster.dto';
import { AthleteByCategoryDto } from '../sismaster/dto/athlete-by-category.dto';
import { AccreditationFilters } from '../sismaster/interfaces/sismaster-filters.interface';
import { toSismasterUrl } from '../sismaster/constants/sismaster.constants';
import { SportParamDto } from '../sismaster/dto/sport-param.dto';
import { HaymasterSportParam } from './entities/haymaster-sport-param.entity';

const HAYMASTER_IDCOMPANY = 1;

@Injectable()
export class HaymasterService {
  private readonly logger = new Logger(HaymasterService.name);

  constructor(
    @InjectRepository(HaymasterEvent, 'haymaster')           
    private readonly eventRepo: Repository<HaymasterEvent>,

    @InjectRepository(SismasterPerson, 'haymaster')
    private readonly personRepo: Repository<SismasterPerson>,

    @InjectRepository(SismasterInstitution, 'haymaster')
    private readonly institutionRepo: Repository<SismasterInstitution>,

    @InjectRepository(SismasterSport, 'haymaster')
    private readonly sportRepo: Repository<SismasterSport>,

    @InjectRepository(SismasterAccreditation, 'haymaster')
    private readonly accreditationRepo: Repository<SismasterAccreditation>,

    @InjectRepository(SismasterEventSport, 'haymaster')
    private readonly eventSportRepo: Repository<SismasterEventSport>,

    @InjectRepository(HaymasterSportParam, 'haymaster')
    private readonly sportParamRepo: Repository<HaymasterSportParam>,

    @InjectDataSource()
    private readonly localDataSource: DataSource,
  ) {}

  async getEventById(idevent: number): Promise<EventSismasterDto> {
    const event = await this.eventRepo.findOne({ where: { idevent } });
    if (!event) {
      throw new NotFoundException(`Evento ${idevent} no encontrado en Haymaster`);
    }
    return event as unknown as EventSismasterDto; 
  }


  async getAllEvents(): Promise<EventSismasterDto[]> {
    const events = await this.eventRepo.find({
      order: { startdate: 'DESC' },
    });
    return events as unknown as EventSismasterDto[];  // ← cast necesario
  }



  async getSportById(idsport: number) {
    const sport = await this.sportRepo.findOne({ where: { idsport } });
    if (!sport) {
      throw new NotFoundException(`Deporte ${idsport} no encontrado en Haymaster`);
    }
    return sport;
  }

  async getAllSports() {
    return await this.sportRepo.find({ order: { name: 'ASC' } });
  }

  async getAthleteById(idperson: number): Promise<SismasterPerson | null> {
    if (!idperson) return null;
    try {
      return await this.personRepo.findOne({
        where: { idperson, mstatus: 1 },
        select: ['idperson', 'firstname', 'lastname', 'surname', 'docnumber', 'gender', 'birthday', 'country'],
      }) || null;
    } catch (error) {
      this.logger.error(`Error fetching person ${idperson}:`, error);
      return null;
    }
  }

  async getAthleteByDocument(docnumber: string) {
    const person = await this.personRepo.findOne({ where: { docnumber } });
    if (!person) {
      throw new NotFoundException(`Atleta con documento ${docnumber} no encontrado`);
    }
    return person;
  }

  async getAccreditedAthletes(filters: AccreditationFilters): Promise<AthleteSismasterDto[]> {
    this.logger.log(`[Haymaster] Consultando acreditaciones: ${JSON.stringify(filters)}`);

    const params: any[] = [filters.idevent];

    let sql = `
      SELECT
        p.idperson, p.docnumber, p.firstname, p.lastname, p.surname,
        p.gender, p.birthday,
        NULL AS photo,
        MAX(a.idinstitution) AS idinstitution,
        MAX(a.idevent) AS idevent,
        MAX(i.name) AS institutionName,
        MAX(i.abrev) AS institutionAbrev,
        MAX(i.avatar) AS institutionLogo

      FROM accreditation a
      INNER JOIN person p ON p.idperson = a.idperson AND p.mstatus = 1
      INNER JOIN institution i ON i.idinstitution = a.idinstitution
      WHERE a.idevent = ? AND a.mstatus = 1 AND a.tregister = 'D'
    `;

    if (filters.idinstitution) {
      sql += ` AND a.idinstitution = ?`;
      params.push(filters.idinstitution);
    }
    if (filters.gender) {
      sql += ` AND p.gender = ?`;
      params.push(filters.gender);
    }
    if (filters.localSportId) {
      const rows = await this.localDataSource.query<{ sismaster_sport_id: number | null }[]>(
        `SELECT sismaster_sport_id FROM sports WHERE sport_id = ? AND deleted_at IS NULL LIMIT 1`,
        [filters.localSportId],
      );
      if (rows.length && rows[0].sismaster_sport_id) {
        sql += ` AND a.idsport = ?`;
        params.push(rows[0].sismaster_sport_id);
      }
    }

    sql += `
      GROUP BY p.idperson, p.docnumber, p.firstname, p.lastname, p.surname,
              p.gender, p.birthday
      ORDER BY p.lastname ASC, p.firstname ASC
    `;

    const results = await this.accreditationRepo.query(sql, params);

    return results.map((row: any) => ({
      ...row,
      photo: toSismasterUrl(row.photo),
      institutionLogo: toSismasterUrl(row.institutionLogo),
      fullName: `${row.firstname} ${row.lastname || ''} ${row.surname || ''}`.trim(),
      age: this.calculateAge(row.birthday),
    }));
  }

  private calculateAge(birthday: Date): number | null {
    if (!birthday) return null;
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  }

  async searchAthletesByName(searchTerm: string, limit: number = 50): Promise<AthleteSismasterDto[]> {
    const query = this.accreditationRepo
      .createQueryBuilder('a')
      .innerJoin('person', 'p', 'a.idperson = p.idperson')
      .innerJoin('institution', 'i', 'a.idinstitution = i.idinstitution')
      .select([
        'p.idperson AS idperson', 'p.docnumber AS docnumber',
        'p.firstname AS firstname', 'p.lastname AS lastname',
        'p.surname AS surname', 'p.gender AS gender',
        'p.birthday AS birthday', 'p.country AS country',
        'NULL AS photo', 'MAX(a.idinstitution) AS idinstitution',
        'i.name AS institutionName',
        'MAX(i.abrev) AS institutionAbrev',
        'MAX(i.avatar) AS institutionLogo',
      ])
      .where('a.mstatus = 1').andWhere('p.mstatus = 1')
      .andWhere(
        '(p.firstname LIKE :search OR p.lastname LIKE :search OR p.surname LIKE :search OR p.docnumber LIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .groupBy('p.idperson').addGroupBy('p.docnumber').addGroupBy('p.firstname')
      .addGroupBy('p.lastname').addGroupBy('p.surname').addGroupBy('p.gender')
      .addGroupBy('p.birthday').addGroupBy('p.country')
      .limit(limit);

    const results = await query.getRawMany();
    return results.map((row) => ({
      ...row,
      photo: toSismasterUrl(row.photo),
      institutionLogo: toSismasterUrl(row.institutionLogo),
      fullName: `${row.firstname} ${row.lastname || ''} ${row.surname || ''}`.trim(),
      age: this.calculateAge(row.birthday),
    }));
  }

  async getPersonById(idperson: number): Promise<SismasterPerson | null> {
    return this.getAthleteById(idperson);
  }

  async getPersonsByIds(ids: number[]): Promise<SismasterPerson[]> {
    if (!ids || ids.length === 0) return [];
    const uniqueIds = [...new Set(ids)].filter((id) => id != null && id > 0);
    if (uniqueIds.length === 0) return [];
    try {
      return await this.personRepo.find({
        where: { idperson: In(uniqueIds), mstatus: 1 },
        select: ['idperson', 'firstname', 'lastname', 'surname', 'docnumber', 'gender', 'birthday', 'country'],
      });
    } catch (error) {
      this.logger.error('Error in batch loading persons:', error);
      return [];
    }
  }

  async getAthletesCount(): Promise<number> {
    const result = await this.accreditationRepo
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT a.idperson)', 'count')
      .where('a.mstatus = 1')
      .getRawOne();
    return parseInt(result.count, 10) || 0;
  }

  async getInstitutionById(idinstitution: number): Promise<SismasterInstitution | null> {
    if (!idinstitution) return null;
    try {
      return await this.institutionRepo.findOne({
        where: { idinstitution, mstatus: 1 },
        select: ['idinstitution', 'business', 'businessName', 'abrev', 'avatar', 'country'],
      }) || null;
    } catch (error) {
      this.logger.error(`Error fetching institution ${idinstitution}:`, error);
      return null;
    }
  }

  async getInstitutionsByIds(ids: number[]): Promise<SismasterInstitution[]> {
    if (!ids || ids.length === 0) return [];
    const uniqueIds = [...new Set(ids)].filter((id) => id != null && id > 0);
    if (uniqueIds.length === 0) return [];
    try {
      return await this.institutionRepo.find({
        where: { idinstitution: In(uniqueIds), mstatus: 1 },
        select: ['idinstitution', 'business', 'businessName', 'abrev', 'avatar', 'country'],
      });
    } catch (error) {
      this.logger.error('Error in batch loading institutions:', error);
      return [];
    }
  }

  async getAllInstitutions() {
    const institutions = await this.institutionRepo.find({
      where: { mstatus: 1 },
      select: ['idinstitution', 'business', 'businessName', 'abrev', 'avatar', 'country'],
      order: { business: 'ASC' },
    });
    return institutions.map((inst) => ({ ...inst, avatar: toSismasterUrl(inst.avatar) }));
  }

  async getSportsByEvent(idevent: number) {
    return this.eventSportRepo
      .createQueryBuilder('es')
      .innerJoin('sport', 's', 's.idsport = es.idsport')
      .select(['es.idsport AS idsport', 's.name AS name', 's.slug AS slug', 's.acronym AS acronym', 's.logo AS logo'])
      .where('es.idevent = :idevent', { idevent })
      .andWhere('es.mstatus = 1')
      .groupBy('es.idsport').addGroupBy('s.name').addGroupBy('s.slug').addGroupBy('s.acronym').addGroupBy('s.logo')
      .orderBy('s.name', 'ASC')
      .getRawMany();
  }

  async getAllSportParams(idsport: number) {
    return this.sportParamRepo
      .createQueryBuilder('sp')
      .select(['sp.idparam', 'sp.name', 'sp.abrev', 'sp.idsport', 'sp.idfather', 'sp.code', 'sp.isleaf'])
      .where('sp.idsport = :idsport', { idsport })
      .andWhere('sp.idcompany = :idcompany', { idcompany: HAYMASTER_IDCOMPANY })
      .orderBy('sp.name', 'ASC')
      .getMany();
  }


  async getAthletesByCategory(idevent: number, idsport: number, idparam: number): Promise<AthleteByCategoryDto[]> {
    const results = await this.accreditationRepo.query(`
      SELECT
        a.idperson,
        MAX(a.idacreditation) AS idacreditation,
        a.idevent, a.idsport,
        MAX(a.idinstitution) AS idinstitution,
        NULL AS photo,
        p.docnumber, p.firstname, p.lastname, p.surname, p.birthday, p.gender,
        CASE WHEN p.gender = 'M' THEN 'Masculino' WHEN p.gender = 'F' THEN 'Femenino' ELSE 'No especificado' END AS gender_text,
        MAX(i.name) AS institutionName,
        MAX(i.abrev) AS institutionAbrev,
        MAX(i.avatar) AS institutionLogo
      FROM accreditation a
      INNER JOIN person p ON p.idperson = a.idperson AND p.mstatus = 1
      INNER JOIN institution i ON i.idinstitution = a.idinstitution
      WHERE a.idsport = ? AND a.idevent = ? AND a.tregister = 'D' AND a.mstatus = 1
        AND EXISTS (
          SELECT 1 FROM accreditation_test atest
          INNER JOIN sport_params sp ON sp.code = atest.idtest
            AND sp.idsport = ?
            AND sp.idcompany = ${HAYMASTER_IDCOMPANY}
            AND sp.idparam = ?
          WHERE atest.idacreditation = a.idacreditation AND atest.mstatus = 1
        )
      GROUP BY a.idperson, a.idevent, a.idsport,
              p.docnumber, p.firstname, p.lastname, p.surname, p.birthday, p.gender
      ORDER BY p.lastname ASC, p.firstname ASC
    `, [idsport, idevent, idsport, idparam]);




    return results.map((row: any) => ({
      ...row,
      photo: toSismasterUrl(row.photo),
      institutionLogo: toSismasterUrl(row.institutionLogo),
      fullName: `${row.firstname} ${row.lastname ?? ''} ${row.surname ?? ''}`.trim(),
      age: this.calculateAge(row.birthday),
    }));
  }

  async getAthletesByCategoryName(sismasterEventId: number, localSportId: number, categoryName: string): Promise<AthleteByCategoryDto[]> {
    const sportRows = await this.localDataSource.query<{ sismaster_sport_id: number | null }[]>(
      `SELECT sismaster_sport_id FROM sports WHERE sport_id = ? AND deleted_at IS NULL LIMIT 1`,
      [localSportId],
    );
    if (!sportRows.length || !sportRows[0].sismaster_sport_id) {
      throw new NotFoundException(`El deporte local #${localSportId} no tiene sismaster_sport_id configurado`);
    }
    const sissportId = sportRows[0].sismaster_sport_id;
    const param = await this.sportParamRepo
      .createQueryBuilder('sp')
      .where('sp.idsport = :idsport', { idsport: sissportId })
      .andWhere('sp.idcompany = :idcompany', { idcompany: HAYMASTER_IDCOMPANY })
      .andWhere('LOWER(TRIM(sp.name)) = LOWER(TRIM(:name))', { name: categoryName })
      .getOne();

    if (!param) return [];
    return this.getAthletesByCategory(sismasterEventId, sissportId, param.idparam);
  }

  async getAthletesByCategoryLocal(
    sismasterEventId: number,
    localSportId: number,
    idparam: number,   // ← este ya llega como haymaster_idparam desde el front
  ): Promise<AthleteByCategoryDto[]> {
    const rows = await this.localDataSource.query<{ sismaster_sport_id: number | null }[]>(
      `SELECT sismaster_sport_id FROM sports WHERE sport_id = ? AND deleted_at IS NULL LIMIT 1`,
      [localSportId],
    );
    if (!rows.length || !rows[0].sismaster_sport_id) {
      throw new NotFoundException(`El deporte local #${localSportId} no tiene sismaster_sport_id configurado`);
    }
    // idsport es el mismo para haymaster, idparam ya viene como haymaster_idparam
    return this.getAthletesByCategory(sismasterEventId, rows[0].sismaster_sport_id, idparam);
  }

  async getSportParamsByEvent(idsport: number, idevent: number): Promise<SportParamDto[]> {
    const results = await this.sportParamRepo.query(`
      SELECT sp.idparam, sp.code, sp.name, sp.idsport, COUNT(DISTINCT a.idperson) AS athleteCount
      FROM sport_params sp
      INNER JOIN accreditation_test atest ON atest.idtest = sp.code AND atest.mstatus = 1
      INNER JOIN accreditation a ON a.idacreditation = atest.idacreditation
        AND a.idsport = ? AND a.idevent = ? AND a.tregister = 'D' AND a.mstatus = 1
      WHERE sp.idsport = ?
        AND sp.idcompany = ?          -- ← nuevo filtro seguro
      GROUP BY sp.idparam, sp.code, sp.name, sp.idsport
      HAVING COUNT(DISTINCT a.idperson) > 0
      ORDER BY sp.name ASC
    `, [idsport, idevent, idsport, HAYMASTER_IDCOMPANY]);
    return results.map((row: any) => ({
      idparam: parseInt(row.idparam), code: row.code, name: row.name,
      idsport: parseInt(row.idsport), athleteCount: parseInt(row.athleteCount) || 0,
    }));
  }

  async getSportParamsByLocalSportId(
    localSportId: number,
    sismasterEventId: number,
  ): Promise<SportParamDto[]> {
    // 1. Resolver idsport (es el mismo en ambas DBs, OK)
    const rows = await this.localDataSource.query<{ sismaster_sport_id: number | null }[]>(
      `SELECT sismaster_sport_id FROM sports WHERE sport_id = ? AND deleted_at IS NULL LIMIT 1`,
      [localSportId],
    );
    if (!rows.length || !rows[0].sismaster_sport_id) {
      throw new NotFoundException(`El deporte local #${localSportId} no tiene sismaster_sport_id configurado`);
    }
    const idsport = rows[0].sismaster_sport_id; // mismo valor para haymaster

    // 2. Obtener los haymaster_idparam que tiene configurados este deporte localmente
    const localCategories = await this.localDataSource.query<
      { haymaster_idparam: number }[]
    >(
      `SELECT DISTINCT haymaster_idparam
      FROM categories        -- o como se llame tu tabla categories
      WHERE sport_id = ?
        AND haymaster_idparam IS NOT NULL
        AND deleted_at IS NULL`,
      [localSportId],
    );

    if (!localCategories.length) {
      // fallback: si no hay haymaster_idparam, retornar vacío o usar sismaster
      return [];
    }

    const haymasterIdparams = localCategories.map((c) => c.haymaster_idparam);

    // 3. Query a haymaster.sport_params filtrado por idcompany=1
    //    y solo los idparam que existen en tus categorías locales
    const placeholders = haymasterIdparams.map(() => '?').join(',');
    const results = await this.sportParamRepo.query(`
      SELECT sp.idparam, sp.code, sp.name, sp.idsport,
            COUNT(DISTINCT a.idperson) AS athleteCount
      FROM sport_params sp
      LEFT JOIN accreditation_test atest ON atest.idtest = sp.code AND atest.mstatus = 1
      LEFT JOIN accreditation a ON a.idacreditation = atest.idacreditation
        AND a.idsport = ? AND a.idevent = ? AND a.tregister = 'D' AND a.mstatus = 1
      WHERE sp.idsport = ?
        AND sp.idcompany = 1
        AND sp.idparam IN (${placeholders})
      GROUP BY sp.idparam, sp.code, sp.name, sp.idsport
      ORDER BY sp.name ASC
    `, [idsport, sismasterEventId, idsport, ...haymasterIdparams]);

    return results.map((row: any) => ({
      idparam: parseInt(row.idparam),
      code: row.code,
      name: row.name,
      idsport: parseInt(row.idsport),
      athleteCount: parseInt(row.athleteCount) || 0,
    }));
  }

  async getNivCatOptions(sismasterEventId: number, sismasterSportId: number, eventCategoryId?: number) {
    let personIdFilter: number[] | null = null;
    if (eventCategoryId) {
      const localRows = await this.localDataSource.query<{ external_athlete_id: number }[]>(
        `SELECT external_athlete_id FROM registrations WHERE event_category_id = ? AND deleted_at IS NULL AND external_athlete_id IS NOT NULL`,
        [eventCategoryId],
      );
      if (localRows.length === 0) return { niv: [], cat: [], combos: [] };
      personIdFilter = localRows.map((r) => Number(r.external_athlete_id));
    }

    let sql = `
      SELECT DISTINCT atest.idniv, atest.idcat, COUNT(DISTINCT a.idperson) AS total
      FROM accreditation_test atest
      INNER JOIN accreditation a ON a.idacreditation = atest.idacreditation
        AND a.idsport = ? AND a.idevent = ? AND a.tregister = 'D' AND a.mstatus = 1
      INNER JOIN person p ON p.idperson = a.idperson
    `;
    const params: any[] = [sismasterSportId, sismasterEventId];

    if (personIdFilter) {
      sql += ` AND a.idperson IN (${personIdFilter.map(() => '?').join(',')}) `;
      params.push(...personIdFilter);
    }
    sql += ` WHERE atest.mstatus = 1 AND atest.idniv IS NOT NULL AND atest.idcat IS NOT NULL
      GROUP BY atest.idniv, atest.idcat ORDER BY atest.idniv ASC, atest.idcat ASC`;

    const rows = await this.accreditationRepo.query(sql, params);
    return {
      niv: [...new Set<string>(rows.map((r: any) => r.idniv))],
      cat: [...new Set<string>(rows.map((r: any) => r.idcat))],
      combos: rows.map((r: any) => ({ idniv: r.idniv, idcat: r.idcat, total: Number(r.total) })),
    };
  }

  async getAthletesByNivAndCat(sismasterEventId: number, localSportId: number, idniv: string, idcat: string): Promise<AthleteByCategoryDto[]> {
    const sportRows = await this.localDataSource.query<{ sismaster_sport_id: number | null }[]>(
      `SELECT sismaster_sport_id FROM sports WHERE sport_id = ? AND deleted_at IS NULL LIMIT 1`,
      [localSportId],
    );
    if (!sportRows.length || !sportRows[0].sismaster_sport_id) {
      throw new NotFoundException(`El deporte local #${localSportId} no tiene sismaster_sport_id configurado`);
    }
    const idsport = sportRows[0].sismaster_sport_id;

    const results = await this.accreditationRepo
      .createQueryBuilder('a')
      .innerJoin('person', 'p', 'a.idperson = p.idperson')
      .innerJoin('institution', 'i', 'a.idinstitution = i.idinstitution')
      .innerJoin('accreditation_test', 'atest', 'atest.idacreditation = a.idacreditation AND atest.mstatus = 1')
      .select([
        'a.idacreditation AS idacreditation', 'a.idevent AS idevent', 'a.idsport AS idsport',
        'a.idinstitution AS idinstitution', 'a.idperson AS idperson', 'NULL AS photo',
        'p.docnumber AS docnumber', 'p.firstname AS firstname', 'p.lastname AS lastname',
        'p.surname AS surname', 'p.birthday AS birthday', 'p.gender AS gender',
        `CASE WHEN p.gender = 'M' THEN 'Masculino' WHEN p.gender = 'F' THEN 'Femenino' ELSE 'No especificado' END AS gender_text`,
        'i.name AS institutionName', 'i.abrev AS institutionAbrev', 'i.avatar AS institutionLogo',
        'atest.idniv AS idniv', 'atest.idcat AS idcat', 'atest.idtest AS idtest',
      ])
      .where('a.idsport = :idsport', { idsport })
      .andWhere('a.idevent = :idevent', { idevent: sismasterEventId })
      .andWhere('a.tregister = :tregister', { tregister: 'D' })
      .andWhere('a.mstatus = 1').andWhere('p.mstatus = 1')
      .andWhere('atest.idniv = :idniv', { idniv })
      .andWhere('atest.idcat = :idcat', { idcat })
      .orderBy('p.lastname', 'ASC').addOrderBy('p.firstname', 'ASC')
      .getRawMany();

    return results.map((row) => ({
      ...row,
      photo: null,
      institutionLogo: toSismasterUrl(row.institutionLogo),
      fullName: `${row.firstname} ${row.lastname ?? ''} ${row.surname ?? ''}`.trim(),
      age: this.calculateAge(row.birthday),
    }));
  }

  async getRegistrationIdsByNivCat(
    sismasterEventId: number, sismasterSportId: number,
    idniv: string, idcat: string, eventCategoryId?: number,
  ): Promise<{ registrationIds: number[]; athletes: any[] }> {
    const sismasterAthletes = await this.accreditationRepo
      .createQueryBuilder('a')
      .innerJoin('person', 'p', 'a.idperson = p.idperson')
      .innerJoin('institution', 'i', 'a.idinstitution = i.idinstitution')
      .innerJoin('accreditation_test', 'atest', 'atest.idacreditation = a.idacreditation AND atest.mstatus = 1')
      .select([
        'a.idacreditation AS idacreditation', 'p.idperson AS idperson', 'p.docnumber AS docnumber',
        'p.firstname AS firstname', 'p.lastname AS lastname', 'p.surname AS surname',
        'p.gender AS gender', 'i.name AS institutionName', 'i.abrev AS institutionAbrev',
        'atest.idniv AS idniv', 'atest.idcat AS idcat',
      ])
      .where('a.idsport = :sport', { sport: sismasterSportId })
      .andWhere('a.idevent = :event', { event: sismasterEventId })
      .andWhere('a.tregister = :tr', { tr: 'D' })
      .andWhere('a.mstatus = 1').andWhere('p.mstatus = 1')
      .andWhere('atest.idniv = :idniv', { idniv })
      .andWhere('atest.idcat = :idcat', { idcat })
      .orderBy('p.lastname', 'ASC').addOrderBy('p.firstname', 'ASC')
      .getRawMany();

    if (!sismasterAthletes.length) return { registrationIds: [], athletes: [] };

    const idpersons = sismasterAthletes.map((a) => a.idperson).filter(Boolean);
    const placeholders = idpersons.map(() => '?').join(',');
    let sql = `SELECT r.registration_id, r.external_athlete_id, r.event_category_id
      FROM registrations r WHERE r.external_athlete_id IN (${placeholders}) AND r.deleted_at IS NULL`;
    const params: any[] = [...idpersons];
    if (eventCategoryId) { sql += ` AND r.event_category_id = ?`; params.push(eventCategoryId); }

    const localRows = await this.localDataSource.query<{ registration_id: number; external_athlete_id: string }[]>(sql, params);
    const regMap = new Map(localRows.map((r) => [String(r.external_athlete_id), r.registration_id]));

    const athletes = sismasterAthletes.map((a) => ({
      ...a,
      fullName: `${a.firstname} ${a.lastname ?? ''} ${a.surname ?? ''}`.trim(),
      photo: toSismasterUrl(a.photo),
      registration_id: regMap.get(String(a.idperson)) ?? null,
    }));

    return { registrationIds: localRows.map((r) => r.registration_id), athletes };
  }
}