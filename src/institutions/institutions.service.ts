import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Institution, Athlete, Team, TeamMember } from './entities';
import {
  CreateInstitutionDto,
  UpdateInstitutionDto,
  CreateAthleteDto,
  UpdateAthleteDto,
  CreateTeamDto,
  UpdateTeamDto,
  AddTeamMemberDto,
} from './dto';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private institutionRepository: Repository<Institution>,
    @InjectRepository(Athlete)
    private athleteRepository: Repository<Athlete>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
  ) {}

  // ==================== INSTITUTIONS ====================

  async createInstitution(
    createDto: CreateInstitutionDto,
  ): Promise<Institution> {
    const institution = this.institutionRepository.create(createDto);
    return this.institutionRepository.save(institution);
  }

  async findAllInstitutions(): Promise<Institution[]> {
    return this.institutionRepository.find({
      where: { deletedAt: IsNull() },
      relations: ['athletes', 'teams'],
      order: { name: 'ASC' },
    });
  }

  async findOneInstitution(id: number): Promise<Institution> {
    const institution = await this.institutionRepository.findOne({
      where: { institutionId: id },
      relations: ['athletes', 'teams'],
      withDeleted: false,
    });

    if (!institution) {
      throw new NotFoundException(`Institución con ID ${id} no encontrada`);
    }

    return institution;
  }

  async updateInstitution(
    id: number,
    updateDto: UpdateInstitutionDto,
  ): Promise<Institution> {
    const institution = await this.findOneInstitution(id);
    Object.assign(institution, updateDto);
    return this.institutionRepository.save(institution);
  }

  async removeInstitution(id: number, userId?: number): Promise<void> {
    const institution = await this.findOneInstitution(id);

    const athletesCount = await this.athleteRepository.count({
      where: { institutionId: id, deletedAt: IsNull() },
    });

    if (athletesCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la institución porque tiene ${athletesCount} atleta(s) asociado(s)`,
      );
    }

    const teamsCount = await this.teamRepository.count({
      where: { institutionId: id, deletedAt: IsNull() },
    });

    if (teamsCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la institución porque tiene ${teamsCount} equipo(s) asociado(s)`,
      );
    }

    await this.institutionRepository.softRemove(institution);

    if (userId) {
      await this.institutionRepository.update(id, { deletedBy: userId });
    }
  }

  async restoreInstitution(id: number): Promise<Institution> {
    const institution = await this.institutionRepository.findOne({
      where: { institutionId: id },
      withDeleted: true,
    });

    if (!institution) {
      throw new NotFoundException(`Institución con ID ${id} no encontrada`);
    }

    if (!institution.deletedAt) {
      throw new BadRequestException('La institución no está eliminada');
    }

    await this.institutionRepository.restore(id);
    await this.institutionRepository.update(id, { deletedBy: undefined });

    return this.findOneInstitution(id);
  }

  async findDeletedInstitutions(): Promise<Institution[]> {
    return this.institutionRepository
      .createQueryBuilder('institution')
      .leftJoinAndSelect('institution.athletes', 'athletes')
      .leftJoinAndSelect('institution.teams', 'teams')
      .where('institution.deletedAt IS NOT NULL')
      .withDeleted()
      .getMany();
  }

  async hardDeleteInstitution(id: number): Promise<void> {
    const institution = await this.institutionRepository.findOne({
      where: { institutionId: id },
      withDeleted: true,
    });

    if (!institution) {
      throw new NotFoundException(`Institución con ID ${id} no encontrada`);
    }

    await this.institutionRepository.remove(institution);
  }

  // ==================== ATHLETES ====================

  async createAthlete(createDto: CreateAthleteDto): Promise<Athlete> {
    if (createDto.institutionId) {
      await this.findOneInstitution(createDto.institutionId);
    }

    const athlete = this.athleteRepository.create(createDto);
    return this.athleteRepository.save(athlete);
  }

  async findAllAthletes(institutionId?: number): Promise<Athlete[]> {
    const where: any = { deletedAt: null };
    if (institutionId) {
      where.institutionId = institutionId;
    }

    return this.athleteRepository.find({
      where,
      relations: ['institution', 'teamMemberships'],
      order: { name: 'ASC' },
    });
  }

  async findOneAthlete(id: number): Promise<Athlete> {
    const athlete = await this.athleteRepository.findOne({
      where: { athleteId: id },
      relations: ['institution', 'teamMemberships', 'teamMemberships.team'],
      withDeleted: false,
    });

    if (!athlete) {
      throw new NotFoundException(`Atleta con ID ${id} no encontrado`);
    }

    return athlete;
  }

  async updateAthlete(
    id: number,
    updateDto: UpdateAthleteDto,
  ): Promise<Athlete> {
    const athlete = await this.findOneAthlete(id);

    if (updateDto.institutionId) {
      await this.findOneInstitution(updateDto.institutionId);
    }

    Object.assign(athlete, updateDto);
    return this.athleteRepository.save(athlete);
  }

  async removeAthlete(id: number, userId?: number): Promise<void> {
    const athlete = await this.findOneAthlete(id);

    await this.athleteRepository.softRemove(athlete);

    if (userId) {
      await this.athleteRepository.update(id, { deletedBy: userId });
    }
  }

  async restoreAthlete(id: number): Promise<Athlete> {
    const athlete = await this.athleteRepository.findOne({
      where: { athleteId: id },
      withDeleted: true,
    });

    if (!athlete) {
      throw new NotFoundException(`Atleta con ID ${id} no encontrado`);
    }

    if (!athlete.deletedAt) {
      throw new BadRequestException('El atleta no está eliminado');
    }

    await this.athleteRepository.restore(id);
    await this.athleteRepository
      .createQueryBuilder()
      .update()
      .set({ deletedBy: null } as any)
      .where('athleteId = :id', { id })
      .execute();


    return this.findOneAthlete(id);
  }

  async findDeletedAthletes(): Promise<Athlete[]> {
    return this.athleteRepository
      .createQueryBuilder('athlete')
      .leftJoinAndSelect('athlete.institution', 'institution')
      .where('athlete.deletedAt IS NOT NULL')
      .withDeleted()
      .getMany();
  }

  async hardDeleteAthlete(id: number): Promise<void> {
    const athlete = await this.athleteRepository.findOne({
      where: { athleteId: id },
      withDeleted: true,
    });

    if (!athlete) {
      throw new NotFoundException(`Atleta con ID ${id} no encontrado`);
    }

    await this.athleteRepository.remove(athlete);
  }

  // ==================== TEAMS ====================

  async createTeam(createDto: CreateTeamDto): Promise<Team> {
    await this.findOneInstitution(createDto.institutionId);

    if (!createDto.categoryId) {
      throw new BadRequestException('categoryId es requerido');
    }

    const team = this.teamRepository.create(createDto);
    return this.teamRepository.save(team);
  }

  async findAllTeams(
    institutionId?: number,
    categoryId?: number,
  ): Promise<Team[]> {
    const queryBuilder = this.teamRepository
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.institution', 'institution')
      .leftJoinAndSelect('team.category', 'category')
      .leftJoinAndSelect('team.members', 'members')
      .leftJoinAndSelect('members.athlete', 'athlete')
      .where('team.deletedAt IS NULL');

    if (institutionId) {
      queryBuilder.andWhere('team.institutionId = :institutionId', {
        institutionId,
      });
    }

    if (categoryId) {
      queryBuilder.andWhere('team.categoryId = :categoryId', { categoryId });
    }

    return queryBuilder.orderBy('team.name', 'ASC').getMany();
  }

  async findOneTeam(id: number): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { teamId: id },
      relations: ['institution', 'category', 'members', 'members.athlete'],
      withDeleted: false,
    });

    if (!team) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    return team;
  }

  async updateTeam(id: number, updateDto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOneTeam(id);

    if (updateDto.institutionId) {
      await this.findOneInstitution(updateDto.institutionId);
    }

    Object.assign(team, updateDto);
    return this.teamRepository.save(team);
  }

  async removeTeam(id: number, userId?: number): Promise<void> {
    const team = await this.findOneTeam(id);

    await this.teamRepository.softRemove(team);

    if (userId) {
      await this.teamRepository.update(id, { deletedBy: userId });
    }
  }

  async restoreTeam(id: number): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { teamId: id },
      withDeleted: true,
    });

    if (!team) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    if (!team.deletedAt) {
      throw new BadRequestException('El equipo no está eliminado');
    }

    await this.teamRepository.restore(id);
    await this.teamRepository.update(id, { deletedBy: undefined });

    return this.findOneTeam(id);
  }

  async findDeletedTeams(): Promise<Team[]> {
    return this.teamRepository
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.institution', 'institution')
      .leftJoinAndSelect('team.category', 'category')
      .leftJoinAndSelect('team.members', 'members')
      .where('team.deletedAt IS NOT NULL')
      .withDeleted()
      .getMany();
  }

  async hardDeleteTeam(id: number): Promise<void> {
    const team = await this.teamRepository.findOne({
      where: { teamId: id },
      withDeleted: true,
    });

    if (!team) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    await this.teamRepository.remove(team);
  }

  // ==================== TEAM MEMBERS ====================

  async addTeamMember(
    teamId: number,
    dto: AddTeamMemberDto,
  ): Promise<TeamMember> {
    await this.findOneTeam(teamId);
    await this.findOneAthlete(dto.athleteId);

    const existing = await this.teamMemberRepository.findOne({
      where: {
        teamId,
        athleteId: dto.athleteId,
      },
    });

    if (existing) {
      throw new BadRequestException('El atleta ya es miembro de este equipo');
    }

    const teamMember = this.teamMemberRepository.create({
      teamId,
      athleteId: dto.athleteId,
      rol: dto.rol || 'titular',
    });

    return this.teamMemberRepository.save(teamMember);
  }

  async removeTeamMember(teamId: number, athleteId: number): Promise<void> {
    const teamMember = await this.teamMemberRepository.findOne({
      where: { teamId, athleteId },
    });

    if (!teamMember) {
      throw new NotFoundException('El atleta no es miembro de este equipo');
    }

    await this.teamMemberRepository.remove(teamMember);
  }

  async updateTeamMemberRole(
    teamId: number,
    athleteId: number,
    rol: string,
  ): Promise<TeamMember> {
    const teamMember = await this.teamMemberRepository.findOne({
      where: { teamId, athleteId },
    });

    if (!teamMember) {
      throw new NotFoundException('El atleta no es miembro de este equipo');
    }

    teamMember.rol = rol;
    return this.teamMemberRepository.save(teamMember);
  }
}
