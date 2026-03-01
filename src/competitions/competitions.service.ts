import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull, In } from 'typeorm';
import {
  Phase,
  Match,
  Participation,
  Standing,
  PhaseManualRank,
  PhaseRegistration,
} from './entities';
import { MatchGame } from './entities/match-game.entity';
import { Registration } from '../events/entities/registration.entity';
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
import { BracketService } from './bracket.service';
import { SetManualRanksDto } from './dto/set-manual-ranks.dto';

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
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    @InjectRepository(PhaseManualRank)
    private phaseManualRankRepository: Repository<PhaseManualRank>,
    @InjectRepository(PhaseRegistration)
    private phaseRegistrationRepository: Repository<PhaseRegistration>,
    @InjectRepository(MatchGame)
    private matchGameRepository: Repository<MatchGame>,
    private dataSource: DataSource,
    private bracketService: BracketService,
  ) {}

  // ==================== PHASES ====================

  async createPhase(createDto: CreatePhaseDto): Promise<Phase> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const phase = this.phaseRepository.create(createDto);
      const savedPhase = await queryRunner.manager.save(phase);

      const phaseWithRelations = await queryRunner.manager.findOne(Phase, {
        where: { phaseId: savedPhase.phaseId },
        relations: [
          'eventCategory',
          'eventCategory.category',
          'eventCategory.category.sport',
          'eventCategory.registrations',
          'eventCategory.registrations.athlete',
          'eventCategory.registrations.athlete.institution',
          'eventCategory.registrations.team',
          'eventCategory.registrations.team.institution', // ← agregar
        ],
      });

      // ── incluir Taolu además de Poomsae ──────────────────────────
      const isScoreTablePhase =
        phaseWithRelations &&
        (this.isPoomsaePhase(phaseWithRelations) ||
          this.isWushuTaoluPhase(phaseWithRelations) ||
          this.isTiroDeportivoPhase(phaseWithRelations) ||
          this.isWeightliftingPhase(phaseWithRelations));

      if (isScoreTablePhase && phaseWithRelations.type === PhaseType.GRUPO) {
        await this.createPoomsaeParticipations(phaseWithRelations, queryRunner);
      } else {
        console.log('NO se crearán participaciones automáticas');
      }
      // ─────────────────────────────────────────────────────────────────────

      await queryRunner.commitTransaction();
      console.log('Transacción completada');

      return this.findOnePhase(savedPhase.phaseId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[CREATE PHASE] Error:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllPhases(eventCategoryId?: number): Promise<Phase[]> {
    const queryBuilder = this.phaseRepository
      .createQueryBuilder('phase')
      .leftJoinAndSelect('phase.eventCategory', 'eventCategory')
      .leftJoinAndSelect(
        'phase.matches',
        'matches',
        'matches.deletedAt IS NULL AND matches.phaseId = phase.phaseId',
      )
      .leftJoinAndSelect('matches.participations', 'participations')
      .leftJoinAndSelect('participations.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .where('phase.deletedAt IS NULL');

    if (eventCategoryId) {
      queryBuilder.andWhere('phase.eventCategoryId = :eventCategoryId', {
        eventCategoryId,
      });
    }

    return queryBuilder.orderBy('phase.displayOrder', 'ASC').getMany();
  }

  async findOnePhase(id: number): Promise<Phase> {
    const phase = await this.phaseRepository
      .createQueryBuilder('phase')
      .leftJoinAndSelect('phase.eventCategory', 'eventCategory')
      .leftJoinAndSelect(
        'phase.matches',
        'matches',
        'matches.deletedAt IS NULL AND matches.phaseId = phase.phaseId',
      )
      .leftJoinAndSelect('matches.participations', 'participations')
      .leftJoinAndSelect('participations.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .leftJoinAndSelect('matches.winner', 'winner')
      .leftJoinAndSelect('phase.standings', 'standings')
      .leftJoinAndSelect('standings.registration', 'standingRegistration')
      .leftJoinAndSelect('standingRegistration.athlete', 'standingAthlete')
      .leftJoinAndSelect(
        'standingAthlete.institution',
        'standingAthleteInstitution',
      )
      .leftJoinAndSelect('standingRegistration.team', 'standingTeam')
      .leftJoinAndSelect('standingTeam.institution', 'standingTeamInstitution')
      .where('phase.phaseId = :id', { id })
      .andWhere('phase.deletedAt IS NULL')
      .getOne();

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

  async removePhase(id: number, userId?: number): Promise<void> {
    const phase = await this.findOnePhase(id);
    await this.phaseRepository.softRemove(phase);
    if (userId) {
      await this.phaseRepository.update(id, { deletedBy: userId });
    }
  }

  async restorePhase(id: number): Promise<Phase> {
    const phase = await this.phaseRepository.findOne({
      where: { phaseId: id },
      withDeleted: true,
    });

    if (!phase) {
      throw new NotFoundException(`Fase con ID ${id} no encontrada`);
    }

    if (!phase.deletedAt) {
      throw new BadRequestException('La fase no está eliminada');
    }

    await this.phaseRepository.restore(id);
    await this.phaseRepository
      .createQueryBuilder()
      .update()
      .set({ deletedBy: null } as any)
      .where('phaseId = :id', { id })
      .execute();

    return this.findOnePhase(id);
  }

  async findDeletedPhases(): Promise<Phase[]> {
    return this.phaseRepository
      .createQueryBuilder('phase')
      .leftJoinAndSelect('phase.eventCategory', 'eventCategory')
      .leftJoinAndSelect('phase.matches', 'matches')
      .where('phase.deletedAt IS NOT NULL')
      .withDeleted()
      .getMany();
  }

  async hardDeletePhase(id: number): Promise<void> {
    const phase = await this.phaseRepository.findOne({
      where: { phaseId: id },
      withDeleted: true,
    });

    if (!phase) {
      throw new NotFoundException(`Fase con ID ${id} no encontrada`);
    }

    await this.phaseRepository.remove(phase);
  }

  async getPhaseRegistrations(phaseId: number) {
    return this.phaseRegistrationRepository.find({
      where: { phaseId },
      relations: [
        'registration',
        'registration.athlete',
        'registration.athlete.institution',
        'registration.team',
        'registration.team.institution',
        'registration.team.members',
        'registration.team.members.athlete',
      ],
      order: { phaseRegistrationId: 'ASC' },
    });
  }

  async assignPhaseRegistration(phaseId: number, registrationId: number) {
    const existing = await this.phaseRegistrationRepository.findOne({
      where: { phaseId, registrationId },
    });
    if (existing) return existing; // idempotente, no lanza error

    const pr = this.phaseRegistrationRepository.create({
      phaseId,
      registrationId,
    });
    return this.phaseRegistrationRepository.save(pr);
  }

  async removePhaseRegistration(phaseId: number, registrationId: number) {
    const pr = await this.phaseRegistrationRepository.findOne({
      where: { phaseId, registrationId },
    });
    if (!pr) throw new NotFoundException('Asignación no encontrada');
    await this.phaseRegistrationRepository.remove(pr);
    return { message: 'Participante removido de la serie' };
  }

  // ==================== MATCHES ====================

  async createMatch(createDto: CreateMatchDto): Promise<Match> {
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
      .leftJoinAndSelect('match.winner', 'winner')
      .where('match.deletedAt IS NULL');

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
      withDeleted: false,
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

  async removeMatch(id: number, userId?: number): Promise<void> {
    const match = await this.findOneMatch(id);
    await this.matchRepository.softRemove(match);
    if (userId) {
      await this.matchRepository.update(id, { deletedBy: userId });
    }
  }

  async restoreMatch(id: number): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { matchId: id },
      withDeleted: true,
    });

    if (!match) {
      throw new NotFoundException(`Match con ID ${id} no encontrado`);
    }

    if (!match.deletedAt) {
      throw new BadRequestException('El match no está eliminado');
    }

    await this.matchRepository.restore(id);
    await this.matchRepository
      .createQueryBuilder()
      .update()
      .set({ deletedBy: null } as any)
      .where('matchId = :id', { id })
      .execute();

    return this.findOneMatch(id);
  }

  async findDeletedMatches(): Promise<Match[]> {
    return this.matchRepository
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.phase', 'phase')
      .leftJoinAndSelect('match.participations', 'participations')
      .where('match.deletedAt IS NOT NULL')
      .withDeleted()
      .getMany();
  }

  async hardDeleteMatch(id: number): Promise<void> {
    const match = await this.matchRepository.findOne({
      where: { matchId: id },
      withDeleted: true,
    });

    if (!match) {
      throw new NotFoundException(`Match con ID ${id} no encontrado`);
    }

    await this.matchRepository.remove(match);
  }

  async setWalkover(
    matchId: number,
    winnerRegistrationId: number,
    reason?: string,
  ): Promise<Match> {
    const match = await this.findOneMatch(matchId);

    if (match.status === MatchStatus.FINALIZADO) {
      throw new BadRequestException('El match ya está finalizado');
    }

    const participation = match.participations?.find(
      (p) => p.registrationId === winnerRegistrationId,
    );

    if (!participation) {
      throw new BadRequestException(
        'El participante ganador no pertenece a este match',
      );
    }

    await this.bracketService.advanceWinner({
      matchId,
      winnerRegistrationId,
    });

    await this.matchRepository.update(matchId, {
      isWalkover: true,
      walkoverReason: reason || 'Walkover',
    });

    return this.findOneMatch(matchId);
  }

  // ==================== PARTICIPATIONS ====================

  async createParticipation(
    createDto: CreateParticipationDto,
  ): Promise<Participation> {
    await this.findOneMatch(createDto.matchId);

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

      const registrations = dto.registrationIds || [];
      const numParticipants = registrations.length;
      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
      const firstRoundMatches = nextPowerOf2 / 2;

      const matches: Match[] = [];
      let matchNumber = 1;

      for (let i = 0; i < firstRoundMatches; i++) {
        const match = queryRunner.manager.create(Match, {
          phaseId: dto.phaseId,
          matchNumber: matchNumber++,
          round: this.getRoundName(firstRoundMatches),
          status: MatchStatus.PROGRAMADO,
        });

        const savedMatch = await queryRunner.manager.save(match);

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

      // 1. Crear standings (igual que antes)
      const standings: Standing[] = [];
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
        standings.push(await queryRunner.manager.save(standing));
      }

      // 2. Circle Method para asignar rondas correctamente
      const regs: (number | null)[] = [...dto.registrationIds];
      const hasOdd = regs.length % 2 !== 0;
      if (hasOdd) regs.push(null); // null = BYE

      const n = regs.length; // siempre par
      const numRounds = n - 1;
      const matchesPerRound = n / 2;
      let matchNumber = 1;

      for (let round = 1; round <= numRounds; round++) {
        for (let i = 0; i < matchesPerRound; i++) {
          const home = regs[i];
          const away = regs[n - 1 - i];

          // Saltear si alguno es BYE (null)
          if (home === null || away === null) continue;

          const match = queryRunner.manager.create(Match, {
            phaseId: dto.phaseId,
            matchNumber: matchNumber++,
            round: String(round), // ← "1", "2", "3", etc.
            status: MatchStatus.PROGRAMADO,
          });
          const savedMatch = await queryRunner.manager.save(match);

          await queryRunner.manager.save(Participation, {
            matchId: savedMatch.matchId,
            registrationId: home,
            corner: Corner.A,
          });
          await queryRunner.manager.save(Participation, {
            matchId: savedMatch.matchId,
            registrationId: away,
            corner: Corner.B,
          });
        }

        // Rotación: fijar el primer elemento, rotar los demás a la derecha
        const fixed = regs[0];
        const last = regs[n - 1];
        for (let k = n - 1; k > 1; k--) regs[k] = regs[k - 1];
        regs[1] = last;
        regs[0] = fixed;
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
      const standings = await this.standingRepository.find({
        where: { phaseId },
        relations: ['registration'],
      });

      const matches = await this.matchRepository.find({
        where: {
          phaseId,
          status: MatchStatus.FINALIZADO,
          deletedAt: IsNull(),
        },
        relations: ['participations', 'participations.registration', 'winner'],
      });

      // ── FIX: cargar todos los MatchGame de los partidos finalizados ──
      const matchIds = matches.map((m) => m.matchId);
      const allGames = matchIds.length
        ? await this.matchGameRepository.find({
            where: { matchId: In(matchIds) },
          })
        : [];

      const gamesByMatch = new Map<number, MatchGame[]>();
      for (const game of allGames) {
        if (!gamesByMatch.has(game.matchId)) gamesByMatch.set(game.matchId, []);
        gamesByMatch.get(game.matchId)!.push(game);
      }
      // ────────────────────────────────────────────────────────────────

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

        s1.matchesPlayed++;
        s2.matchesPlayed++;

        if (match.winnerRegistrationId) {
          if (match.winnerRegistrationId === p1.registrationId) {
            s1.wins++;
            s1.points += 3;
            s2.losses++;
          } else if (match.winnerRegistrationId === p2.registrationId) {
            s2.wins++;
            s2.points += 3;
            s1.losses++;
          }
        }

        // ── FIX: acumular sets ganados/perdidos ──────────────────────
        const games = gamesByMatch.get(match.matchId) ?? [];
        for (const game of games) {
          const sets1 = game.score1 ?? 0; // sets ganados por player1 del juego
          const sets2 = game.score2 ?? 0; // sets ganados por player2 del juego

          // p1 de la participation ↔ player1Id del game (mismo orden de creación)
          s1.scoreFor += sets1;
          s1.scoreAgainst += sets2;
          s2.scoreFor += sets2;
          s2.scoreAgainst += sets1;
        }
        // ────────────────────────────────────────────────────────────
      }

      for (const standing of standings) {
        standing.scoreDiff = standing.scoreFor - standing.scoreAgainst;
      }

      standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
        return b.scoreFor - a.scoreFor;
      });

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

  // ==================== BEST OF 3 ====================

  async initializeBestOf3Series(phaseId: number, registrationIds: number[]) {
    if (registrationIds.length !== 2) {
      throw new BadRequestException(
        'Mejor de 3 requiere exactamente 2 participantes',
      );
    }

    const phase = await this.phaseRepository.findOne({ where: { phaseId } });

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
          status: MatchStatus.PROGRAMADO,
        });

        const savedMatch = await queryRunner.manager.save(match);
        matches.push(savedMatch);

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

    match.winnerRegistrationId = winnerRegistrationId;
    match.status = MatchStatus.FINALIZADO;
    await this.matchRepository.save(match);

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

    const ganadorEntry = Object.entries(victorias).find(
      ([_, wins]) => wins >= 2,
    );

    if (ganadorEntry) {
      const [ganadorId] = ganadorEntry;

      const partidosPendientes = await this.matchRepository.find({
        where: { phaseId: match.phaseId, status: MatchStatus.PROGRAMADO },
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

  // ==================== MANUAL RANKS ====================

  async getManualRanks(phaseId: number) {
    const rows: any[] = await this.dataSource.query(
      `SELECT pmr.id, pmr.phase_id AS phaseId, pmr.registration_id AS registrationId,
              pmr.manual_rank_position AS manualRankPosition, pmr.updated_at AS updatedAt,
              a.name AS athleteName, a.photo_url AS photoUrl,
              ai.name AS institutionName, ai.abrev AS institutionAbrev, ai.logo_url AS logoUrl,
              t.name AS teamName,
              ti.name AS teamInstitutionName, ti.abrev AS teamInstitutionAbrev, ti.logo_url AS teamLogoUrl
      FROM phase_manual_ranks pmr
      LEFT JOIN registrations r  ON r.registration_id = pmr.registration_id
      LEFT JOIN athletes a        ON a.athlete_id = r.athlete_id
      LEFT JOIN institutions ai   ON ai.institution_id = a.institution_id
      LEFT JOIN teams t           ON t.team_id = r.team_id
      LEFT JOIN institutions ti   ON ti.institution_id = t.institution_id
      WHERE pmr.phase_id = ?
      ORDER BY pmr.manual_rank_position ASC`,
      [phaseId],
    );

    return rows.map((row) => ({
      id: row.id,
      phaseId: row.phaseId,
      registrationId: row.registrationId,
      manualRankPosition: row.manualRankPosition,
      updatedAt: row.updatedAt,
      registration: {
        athlete: row.athleteName
          ? {
              name: row.athleteName,
              photoUrl: row.photoUrl,
              institution: row.institutionName
                ? {
                    name: row.institutionName,
                    abrev: row.institutionAbrev,
                    logoUrl: row.logoUrl,
                  }
                : null,
            }
          : null,
        team: row.teamName
          ? {
              name: row.teamName,
              institution: row.teamInstitutionName
                ? {
                    name: row.teamInstitutionName,
                    abrev: row.teamInstitutionAbrev,
                    logoUrl: row.teamLogoUrl,
                  }
                : null,
            }
          : null,
      },
    }));
  }

  async setManualStandingRanks(
    phaseId: number,
    dto: SetManualRanksDto,
  ): Promise<{ updated: number }> {
    const registrationIds = dto.ranks.map((r) => r.registrationId);

    const participations = await this.participationRepository
      .createQueryBuilder('p')
      .innerJoin('p.match', 'm')
      .where('m.phaseId = :phaseId', { phaseId })
      .andWhere('m.deletedAt IS NULL')
      .andWhere('p.registrationId IN (:...registrationIds)', {
        registrationIds,
      })
      .getMany();

    const foundIds = new Set(participations.map((p) => p.registrationId));
    const missing = registrationIds.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Registrations no pertenecen a la fase ${phaseId}: ${missing.join(', ')}`,
      );
    }

    await Promise.all(
      dto.ranks.map((item) =>
        this.dataSource.query(
          `INSERT INTO phase_manual_ranks (phase_id, registration_id, manual_rank_position, updated_at)
          VALUES (?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE manual_rank_position = VALUES(manual_rank_position), updated_at = NOW()`,
          [phaseId, item.registrationId, item.manualRankPosition],
        ),
      ),
    );

    return { updated: dto.ranks.length };
  }

  async clearManualStandingRanks(
    phaseId: number,
  ): Promise<{ cleared: number }> {
    const result = await this.dataSource.query(
      `DELETE FROM phase_manual_ranks WHERE phase_id = ?`,
      [phaseId],
    );
    return { cleared: result.affectedRows ?? 0 };
  }

  async updateRegistrationSeed(
    registrationId: number,
    seedNumber: number | null,
  ): Promise<Registration> {
    const registration = await this.registrationRepository.findOne({
      where: { registrationId },
    });

    if (!registration) {
      throw new NotFoundException(
        `Registration ${registrationId} no encontrada`,
      );
    }

    if (seedNumber !== null) {
      const duplicate = await this.registrationRepository.findOne({
        where: {
          eventCategoryId: registration.eventCategoryId,
          seedNumber,
          registrationId: Not(registrationId),
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          `El seed ${seedNumber} ya está asignado a otro participante en esta categoría`,
        );
      }
    }

    registration.seedNumber = seedNumber;
    return await this.registrationRepository.save(registration);
  }

  async processPhaseByesAutomatically(phaseId: number): Promise<{
    processed: number;
    message: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const matches = await queryRunner.manager.find(Match, {
        where: { phaseId, deletedAt: IsNull() },
        relations: ['participations', 'participations.registration'],
        order: { matchNumber: 'ASC' },
      });

      let processedCount = 0;

      for (const match of matches) {
        if (
          match.participations.length === 1 &&
          !match.winnerRegistrationId &&
          match.status !== MatchStatus.FINALIZADO
        ) {
          const winner = match.participations[0];

          if (!winner.registrationId) {
            console.warn(
              `Match #${match.matchNumber} tiene una participación sin registrationId`,
            );
            continue;
          }

          match.winnerRegistrationId = winner.registrationId;
          match.status = MatchStatus.FINALIZADO;
          await queryRunner.manager.save(match);

          console.log(
            `BYE procesado: Match #${match.matchNumber} - Registration ${winner.registrationId} avanza`,
          );

          await this.bracketService['autoAdvanceWinner'](
            queryRunner,
            match,
            winner.registrationId,
            matches,
          );

          processedCount++;
        }
      }

      await queryRunner.commitTransaction();

      return {
        processed: processedCount,
        message: `${processedCount} BYE${processedCount !== 1 ? 's' : ''} procesado${processedCount !== 1 ? 's' : ''} correctamente`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== POOMSAE / TAOLU (SCORE TABLE) ====================

  private isPoomsaePhase(phase: Phase): boolean {
    const categoryName =
      phase.eventCategory?.category?.name?.toLowerCase() || '';
    return (
      categoryName.includes('poomsae') ||
      categoryName.includes('formas') ||
      categoryName.includes('forma')
    );
  }

  private isWushuTaoluPhase(phase: Phase): boolean {
    const sportName =
      phase.eventCategory?.category?.sport?.name?.toLowerCase() || '';
    const categoryName =
      phase.eventCategory?.category?.name?.toLowerCase() || '';
    return (
      sportName.includes('wushu') &&
      (categoryName.includes('taolu') ||
        categoryName.includes('formas') ||
        categoryName.includes('forma'))
    );
  }

  private isTiroDeportivoPhase(phase: Phase): boolean {
    const sportName =
      phase.eventCategory?.category?.sport?.name?.toLowerCase() || '';
    return (
      sportName.includes('tiro deportivo') ||
      sportName.includes('tiro al blanco') ||
      sportName.includes('shooting')
    );
  }

  private isWeightliftingPhase(phase: Phase): boolean {
    const sportName =
      phase.eventCategory?.category?.sport?.name?.toLowerCase() || '';
    return (
      sportName.includes('halterofilia') ||
      sportName.includes('weightlifting') ||
      sportName.includes('levantamiento de pesas')
    );
  }

  private async createPoomsaeParticipations(
    phase: Phase,
    queryRunner: any,
  ): Promise<void> {
    const registrations = phase.eventCategory?.registrations || [];

    if (registrations.length === 0) {
      console.log(
        `Fase ${phase.phaseId} de tabla de puntajes creada sin atletas inscritos`,
      );
      return;
    }

    const match = queryRunner.manager.create(Match, {
      phaseId: phase.phaseId,
      matchNumber: 1,
      round: 'Final',
      status: MatchStatus.EN_CURSO,
    });

    const savedMatch = await queryRunner.manager.save(match);

    for (const registration of registrations) {
      const participation = queryRunner.manager.create(Participation, {
        matchId: savedMatch.matchId,
        registrationId: registration.registrationId,
      });
      await queryRunner.manager.save(participation);
    }

    console.log(
      `Creadas ${registrations.length} participaciones para tabla de puntajes en fase ${phase.phaseId}`,
    );
  }
}
