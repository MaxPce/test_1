import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Phase, Match, Participation, Standing } from './entities';
import {
  CreatePhaseDto,
  UpdatePhaseDto,
  CreateMatchDto,
  UpdateMatchDto,
  CreateParticipationDto,
  GenerateBracketDto,
  InitializeRoundRobinDto,
} from './dto';
import { PhaseType, MatchStatus, Corner } from '../common/enums';

@Injectable()
export class CompetitionsService {
  constructor(
    @InjectRepository(Phase)
    private phaseRepository: Repository<Phase>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Participation)
    private participationRepository: Repository<Participation>,
    @InjectRepository(Standing)
    private standingRepository: Repository<Standing>,
    private dataSource: DataSource,
  ) {}

  // ==================== PHASES ====================

  async createPhase(createDto: CreatePhaseDto): Promise<Phase> {
    const phase = this.phaseRepository.create(createDto);
    return this.phaseRepository.save(phase);
  }

  async findAllPhases(eventCategoryId?: number): Promise<Phase[]> {
    const queryBuilder = this.phaseRepository
      .createQueryBuilder('phase')
      .leftJoinAndSelect('phase.eventCategory', 'eventCategory')
      .leftJoinAndSelect('phase.matches', 'matches')
      .leftJoinAndSelect('matches.participations', 'participations')
      .leftJoinAndSelect('participations.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution');

    if (eventCategoryId) {
      queryBuilder.andWhere('phase.eventCategoryId = :eventCategoryId', {
        eventCategoryId,
      });
    }

    return queryBuilder.orderBy('phase.displayOrder', 'ASC').getMany();
  }

  async findOnePhase(id: number): Promise<Phase> {
    const phase = await this.phaseRepository.findOne({
      where: { phaseId: id },
      relations: [
        'eventCategory',
        'matches',
        'matches.participations',
        'matches.participations.registration',
        'matches.participations.registration.athlete',
        'matches.participations.registration.athlete.institution',
        'matches.participations.registration.team',
        'matches.participations.registration.team.institution',
        'matches.winner',
        'standings',
        'standings.registration',
        'standings.registration.athlete',
        'standings.registration.athlete.institution',
        'standings.registration.team',
        'standings.registration.team.institution',
      ],
    });

    if (!phase) {
      throw new NotFoundException(`Fase con ID ${id} no encontrada`);
    }

    return phase;
  }

  async updatePhase(id: number, updateDto: UpdatePhaseDto): Promise<Phase> {
    const phase = await this.findOnePhase(id);
    Object.assign(phase, updateDto);
    return this.phaseRepository.save(phase);
  }

  async removePhase(id: number): Promise<void> {
    const phase = await this.findOnePhase(id);
    await this.phaseRepository.remove(phase);
  }

  // ==================== MATCHES ====================

  async createMatch(createDto: CreateMatchDto): Promise<Match> {
    // Verificar que la fase existe
    await this.findOnePhase(createDto.phaseId);

    const match = this.matchRepository.create(createDto);
    return this.matchRepository.save(match);
  }

  async findAllMatches(
    phaseId?: number,
    status?: MatchStatus,
  ): Promise<Match[]> {
    const queryBuilder = this.matchRepository
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.phase', 'phase')
      .leftJoinAndSelect('match.participations', 'participations')
      .leftJoinAndSelect('participations.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .leftJoinAndSelect('match.winner', 'winner');

    if (phaseId) {
      queryBuilder.andWhere('match.phaseId = :phaseId', { phaseId });
    }

    if (status) {
      queryBuilder.andWhere('match.status = :status', { status });
    }

    return queryBuilder
      .orderBy('match.scheduledTime', 'ASC')
      .addOrderBy('match.matchNumber', 'ASC')
      .getMany();
  }

  async findOneMatch(id: number): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { matchId: id },
      relations: [
        'phase',
        'phase.eventCategory',
        'phase.eventCategory.category',
        'participations',
        'participations.registration',
        'participations.registration.athlete',
        'participations.registration.athlete.institution',
        'participations.registration.team',
        'participations.registration.team.institution',
        'participations.registration.team.members',
        'participations.registration.team.members.athlete',
        'winner',
      ],
    });

    if (!match) {
      throw new NotFoundException(`Match con ID ${id} no encontrado`);
    }

    return match;
  }

  async updateMatch(id: number, updateDto: UpdateMatchDto): Promise<Match> {
    const match = await this.findOneMatch(id);
    Object.assign(match, updateDto);
    return this.matchRepository.save(match);
  }

  async removeMatch(id: number): Promise<void> {
    const match = await this.findOneMatch(id);
    await this.matchRepository.remove(match);
  }

  // ==================== PARTICIPATIONS ====================

  async createParticipation(
    createDto: CreateParticipationDto,
  ): Promise<Participation> {
    // Verificar que el match existe
    await this.findOneMatch(createDto.matchId);

    // Verificar que no esté ya participando
    const existing = await this.participationRepository.findOne({
      where: {
        matchId: createDto.matchId,
        registrationId: createDto.registrationId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Este registro ya está participando en el match',
      );
    }

    const participation = this.participationRepository.create(createDto);
    return this.participationRepository.save(participation);
  }

  async findParticipationsByMatch(matchId: number): Promise<Participation[]> {
    return this.participationRepository.find({
      where: { matchId },
      relations: [
        'registration',
        'registration.athlete',
        'registration.athlete.institution',
        'registration.team',
        'registration.team.institution',
      ],
    });
  }

  async removeParticipation(
    matchId: number,
    registrationId: number,
  ): Promise<void> {
    const participation = await this.participationRepository.findOne({
      where: { matchId, registrationId },
    });

    if (!participation) {
      throw new NotFoundException('Participación no encontrada');
    }

    await this.participationRepository.remove(participation);
  }

  // ==================== BRACKET GENERATION ====================

  async generateBracket(dto: GenerateBracketDto): Promise<Match[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const phase = await this.findOnePhase(dto.phaseId);

      if (phase.type !== PhaseType.ELIMINACION) {
        throw new BadRequestException(
          'Solo se pueden generar brackets para fases de eliminación',
        );
      }

      const registrations = dto.registrationIds;
      const numParticipants = registrations.length;

      // Calcular número de matches de primera ronda
      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
      const firstRoundMatches = nextPowerOf2 / 2;

      const matches: Match[] = [];
      let matchNumber = 1;

      // Generar primera ronda
      for (let i = 0; i < firstRoundMatches; i++) {
        const match = queryRunner.manager.create(Match, {
          phaseId: dto.phaseId,
          matchNumber: matchNumber++,
          round: this.getRoundName(firstRoundMatches),
          status: MatchStatus.PROGRAMADO,
        });

        const savedMatch = await queryRunner.manager.save(match);

        // Asignar participantes si hay
        if (registrations[i * 2]) {
          await queryRunner.manager.save(Participation, {
            matchId: savedMatch.matchId,
            registrationId: registrations[i * 2],
            corner: Corner.BLUE,
          });
        }

        if (registrations[i * 2 + 1]) {
          await queryRunner.manager.save(Participation, {
            matchId: savedMatch.matchId,
            registrationId: registrations[i * 2 + 1],
            corner: Corner.WHITE,
          });
        }

        matches.push(savedMatch);
      }

      await queryRunner.commitTransaction();
      return matches;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private getRoundName(numMatches: number): string {
    const rounds: { [key: number]: string } = {
      1: 'final',
      2: 'semifinal',
      4: 'cuartos',
      8: 'octavos',
      16: 'dieciseisavos',
    };
    return rounds[numMatches] || `ronda_${numMatches * 2}`;
  }

  // ==================== ROUND ROBIN ====================

  async initializeRoundRobin(
    dto: InitializeRoundRobinDto,
  ): Promise<Standing[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const phase = await this.findOnePhase(dto.phaseId);

      if (phase.type !== PhaseType.GRUPO) {
        throw new BadRequestException(
          'Solo se puede inicializar round robin para fases de grupo',
        );
      }

      const standings: Standing[] = [];

      // Crear standings para cada registro
      for (const registrationId of dto.registrationIds) {
        const standing = queryRunner.manager.create(Standing, {
          phaseId: dto.phaseId,
          registrationId,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          scoreFor: 0,
          scoreAgainst: 0,
          scoreDiff: 0,
        });

        const saved = await queryRunner.manager.save(standing);
        standings.push(saved);
      }

      // Generar todos los matches (todos contra todos)
      const registrations = dto.registrationIds;
      let matchNumber = 1;

      for (let i = 0; i < registrations.length; i++) {
        for (let j = i + 1; j < registrations.length; j++) {
          const match = queryRunner.manager.create(Match, {
            phaseId: dto.phaseId,
            matchNumber: matchNumber++,
            status: MatchStatus.PROGRAMADO,
          });

          const savedMatch = await queryRunner.manager.save(match);

          // Crear participaciones
          await queryRunner.manager.save(Participation, {
            matchId: savedMatch.matchId,
            registrationId: registrations[i],
            corner: Corner.A,
          });

          await queryRunner.manager.save(Participation, {
            matchId: savedMatch.matchId,
            registrationId: registrations[j],
            corner: Corner.B,
          });
        }
      }

      await queryRunner.commitTransaction();
      return standings;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== STANDINGS ====================

  async getStandings(phaseId: number): Promise<Standing[]> {
    return this.standingRepository.find({
      where: { phaseId },
      relations: [
        'registration',
        'registration.athlete',
        'registration.athlete.institution',
        'registration.team',
        'registration.team.institution',
      ],
      order: {
        points: 'DESC',
        scoreDiff: 'DESC',
        scoreFor: 'DESC',
      },
    });
  }

  async updateStandings(phaseId: number): Promise<Standing[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener todos los standings de esta fase
      const standings = await this.standingRepository.find({
        where: { phaseId },
        relations: ['registration'],
      });

      // Obtener todos los partidos finalizados de esta fase
      const matches = await this.matchRepository.find({
        where: {
          phaseId,
          status: MatchStatus.FINALIZADO,
        },
        relations: ['participations', 'participations.registration', 'winner'],
      });

      // Resetear estadísticas
      for (const standing of standings) {
        standing.matchesPlayed = 0;
        standing.wins = 0;
        standing.draws = 0;
        standing.losses = 0;
        standing.points = 0;
        standing.scoreFor = 0;
        standing.scoreAgainst = 0;
        standing.scoreDiff = 0;
      }

      // Calcular estadísticas basadas en partidos finalizados
      for (const match of matches) {
        if (match.participations.length !== 2) continue;

        const [p1, p2] = match.participations;

        const s1 = standings.find(
          (s) => s.registrationId === p1.registrationId,
        );
        const s2 = standings.find(
          (s) => s.registrationId === p2.registrationId,
        );

        if (!s1 || !s2) continue;

        // Incrementar partidos jugados
        s1.matchesPlayed++;
        s2.matchesPlayed++;

        // Si hay ganador
        if (match.winnerRegistrationId) {
          if (match.winnerRegistrationId === p1.registrationId) {
            // p1 ganó
            s1.wins++;
            s1.points += 3;
            s2.losses++;
          } else if (match.winnerRegistrationId === p2.registrationId) {
            // p2 ganó
            s2.wins++;
            s2.points += 3;
            s1.losses++;
          }
        } else {
          // Empate (si no hay ganador)
          s1.draws++;
          s2.draws++;
          s1.points += 1;
          s2.points += 1;
        }

        // Si tienes marcadores en el match, actualiza scoreFor/scoreAgainst
        // Por ahora dejamos en 0 si no hay campo de marcador
      }

      // Calcular diferencia de goles/puntos
      for (const standing of standings) {
        standing.scoreDiff = standing.scoreFor - standing.scoreAgainst;
      }

      // Ordenar por puntos, diferencia, goles a favor
      standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
        return b.scoreFor - a.scoreFor;
      });

      // Asignar posiciones
      let currentRank = 1;
      for (const standing of standings) {
        standing.rankPosition = currentRank++;
        await queryRunner.manager.save(standing);
      }

      await queryRunner.commitTransaction();

      return this.getStandings(phaseId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
