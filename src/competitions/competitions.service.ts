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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Crear la fase
      const phase = this.phaseRepository.create(createDto);
      const savedPhase = await queryRunner.manager.save(phase);

      // ✅ NUEVO: Cargar la fase con sus relaciones para detectar Poomsae
      const phaseWithRelations = await queryRunner.manager.findOne(Phase, {
        where: { phaseId: savedPhase.phaseId },
        relations: [
          'eventCategory',
          'eventCategory.category',
          'eventCategory.category.sport',
          'eventCategory.registrations',
          'eventCategory.registrations.athlete',
          'eventCategory.registrations.athlete.institution',
        ],
      });

      // ✅ NUEVO: Si es Poomsae, crear participaciones automáticamente
      if (phaseWithRelations && this.isPoomsaePhase(phaseWithRelations)) {
        await this.createPoomsaeParticipations(phaseWithRelations, queryRunner);
      }

      await queryRunner.commitTransaction();

      // Retornar la fase completa
      return this.findOnePhase(savedPhase.phaseId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
      .leftJoinAndSelect('team.members', 'teamMembers')
      .leftJoinAndSelect('teamMembers.athlete', 'memberAthlete')
      .leftJoinAndSelect('memberAthlete.institution', 'memberInstitution')
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
        'phase.eventCategory.category.sport',
        'participations',
        'participations.registration',
        'participations.registration.athlete',
        'participations.registration.athlete.institution',
        'participations.registration.team',
        'participations.registration.team.institution',
        'participations.registration.team.members',
        'participations.registration.team.members.athlete',
        'participations.registration.team.members.athlete.institution',
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

  async initializeBestOf3Series(phaseId: number, registrationIds: number[]) {
    if (registrationIds.length !== 2) {
      throw new BadRequestException(
        'Mejor de 3 requiere exactamente 2 participantes',
      );
    }

    const phase = await this.phaseRepository.findOne({
      where: { phaseId },
    });

    if (!phase) {
      throw new NotFoundException('Fase no encontrada');
    }

    if (phase.type !== PhaseType.MEJOR_DE_3) {
      throw new BadRequestException('Esta fase no es de tipo Mejor de 3');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const matches: Match[] = [];

      for (let i = 1; i <= 3; i++) {
        const match = queryRunner.manager.create(Match, {
          phaseId: phase.phaseId,
          matchNumber: i,
          round: `Partido ${i} de 3`,
          status: i === 1 ? MatchStatus.PROGRAMADO : MatchStatus.PROGRAMADO,
        });

        const savedMatch = await queryRunner.manager.save(match);
        matches.push(savedMatch);

        // Crear participaciones para cada partido
        const participations = registrationIds.map((regId, index) =>
          queryRunner.manager.create(Participation, {
            matchId: savedMatch.matchId,
            registrationId: regId,
            corner: index === 0 ? Corner.A : Corner.B,
          }),
        );

        await queryRunner.manager.save(participations);
      }

      await queryRunner.commitTransaction();

      return {
        message: 'Serie Mejor de 3 inicializada correctamente',
        matches,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateBestOf3MatchResult(
    matchId: number,
    winnerRegistrationId: number,
  ) {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: ['phase', 'phase.matches', 'participations'],
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (match.phase.type !== PhaseType.MEJOR_DE_3) {
      throw new BadRequestException('Este partido no es de tipo Mejor de 3');
    }

    // Actualizar el resultado del partido actual
    match.winnerRegistrationId = winnerRegistrationId;
    match.status = MatchStatus.FINALIZADO;
    await this.matchRepository.save(match);

    // Contar victorias de cada participante
    const allMatches = await this.matchRepository.find({
      where: { phaseId: match.phaseId, status: MatchStatus.FINALIZADO },
    });

    const victorias: Record<number, number> = {};
    allMatches.forEach((m) => {
      if (m.winnerRegistrationId) {
        victorias[m.winnerRegistrationId] =
          (victorias[m.winnerRegistrationId] || 0) + 1;
      }
    });

    // Verificar si alguien ya ganó 2 partidos
    const ganadorEntry = Object.entries(victorias).find(
      ([_, wins]) => wins >= 2,
    );

    if (ganadorEntry) {
      const [ganadorId] = ganadorEntry;

      // Marcar partidos restantes como CANCELADOS
      const partidosPendientes = await this.matchRepository.find({
        where: {
          phaseId: match.phaseId,
          status: MatchStatus.PROGRAMADO,
        },
      });

      for (const p of partidosPendientes) {
        p.status = MatchStatus.CANCELADO;
        await this.matchRepository.save(p);
      }

      return {
        message: 'Serie completada',
        winner: Number(ganadorId),
        victorias,
        serieCompleta: true,
      };
    }

    return {
      message: 'Partido actualizado, serie continúa',
      victorias,
      serieCompleta: false,
    };
  }

  // ==================== TAEKWONDO POOMSAE ====================

  /**
   * Detectar si una fase es de Poomsae basándose en el nombre de la categoría
   */
  private isPoomsaePhase(phase: Phase): boolean {
    const categoryName =
      phase.eventCategory?.category?.name?.toLowerCase() || '';

    return (
      categoryName.includes('poomsae') ||
      categoryName.includes('formas') ||
      categoryName.includes('forma')
    );
  }

  /**
   * Crear participaciones para todos los atletas inscritos en Poomsae
   */
  private async createPoomsaeParticipations(
    phase: Phase,
    queryRunner: any,
  ): Promise<void> {
    const registrations = phase.eventCategory?.registrations || [];

    if (registrations.length === 0) {
      console.log(
        `⚠️  Fase ${phase.phaseId} de Poomsae creada sin atletas inscritos`,
      );
      return;
    }

    // Crear un match único para la fase de Poomsae
    const match = queryRunner.manager.create(Match, {
      phaseId: phase.phaseId,
      matchNumber: 1,
      round: 'Final',
      status: MatchStatus.EN_CURSO,
    });

    const savedMatch = await queryRunner.manager.save(match);

    // Crear una participación por cada atleta inscrito
    for (const registration of registrations) {
      const participation = queryRunner.manager.create(Participation, {
        matchId: savedMatch.matchId,
        registrationId: registration.registrationId,
      });

      await queryRunner.manager.save(participation);
    }

    console.log(
      `✅ Creadas ${registrations.length} participaciones para Poomsae en fase ${phase.phaseId}`,
    );
  }
}
