import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventCategory } from '../events/entities/event-category.entity';
import { Registration } from '../events/entities/registration.entity';
import { Phase } from '../competitions/entities/phase.entity';
import { Match } from '../competitions/entities/match.entity';
import { Standing } from '../competitions/entities/standing.entity';
import { PhaseManualRank } from '../competitions/entities/phase-manual-rank.entity';
import { PhaseRegistration } from '../competitions/entities/phase-registration.entity';
import { IndividualScore } from '../competitions/entities/individual-score.entity';
import { ShootingScore } from '../competitions/entities/shooting-score.entity';
import { MatchGame } from '../competitions/entities/match-game.entity';
import { AthleticsSection } from '../competitions/entities/athletics-section.entity';
import { AthleticsSectionEntry } from '../competitions/entities/athletics-section-entry.entity';
import { AthleticsResult } from '../competitions/entities/athletics-result.entity';
import { SismasterService } from './sismaster.service';
import { EventSismasterDto } from './dto/event-sismaster.dto';
import { MatchStatus } from '../common/enums';
import { Result }        from '../results/entities/result.entity';
import { Participation } from '../competitions/entities/participation.entity';

interface PhaseReportFilters {
  sportId?: number;
  eventCategoryId?: number;
  phaseId?: number;
}
const ATHLETICS_PHASE_TYPES = [
  'combined_pista',
  'combined_distancia',
  'combined_altura',
] as const;
type AthleticsPhaseType = (typeof ATHLETICS_PHASE_TYPES)[number];

@Injectable()
export class CompetitionPhaseReportService {
  constructor(
    @InjectRepository(EventCategory)
    private readonly eventCategoryRepo: Repository<EventCategory>,

    @InjectRepository(Registration)
    private readonly registrationRepo: Repository<Registration>,

    @InjectRepository(Phase)
    private readonly phaseRepo: Repository<Phase>,

    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,

    @InjectRepository(Standing)
    private readonly standingRepo: Repository<Standing>,

    @InjectRepository(PhaseManualRank)
    private readonly phaseManualRankRepo: Repository<PhaseManualRank>,

    @InjectRepository(PhaseRegistration)
    private readonly phaseRegistrationRepo: Repository<PhaseRegistration>,

    @InjectRepository(MatchGame)
    private readonly matchGameRepo: Repository<MatchGame>,

    @InjectRepository(IndividualScore)
    private readonly individualScoreRepo: Repository<IndividualScore>,

    @InjectRepository(ShootingScore)
    private readonly shootingScoreRepo: Repository<ShootingScore>,

    @InjectRepository(AthleticsSection)
    private readonly athleticsSectionRepo: Repository<AthleticsSection>,

    @InjectRepository(AthleticsSectionEntry)
    private readonly athleticsSectionEntryRepo: Repository<AthleticsSectionEntry>,

    @InjectRepository(AthleticsResult)
    private readonly athleticsResultRepo: Repository<AthleticsResult>,

    @InjectRepository(Result)
    private readonly resultRepo: Repository<Result>,

    @InjectRepository(Participation)
    private readonly participationRepo: Repository<Participation>,

    private readonly sismasterService: SismasterService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────────────────────────────────

  async getPhaseReport(
    sismasterEventId: number,
    filters: PhaseReportFilters = {},
  ) {
    // 1. Evento desde Sismaster
    const sismasterEvent =
      await this.sismasterService.getEventById(sismasterEventId);
    if (!sismasterEvent) {
      throw new NotFoundException(
        `Evento Sismaster #${sismasterEventId} no encontrado`,
      );
    }

    // 2. Categorías del evento
    const eventCategories = await this.eventCategoryRepo.find({
      where: { externalEventId: sismasterEventId },
      relations: ['category', 'category.sport'],
    });

    let filteredCategories = eventCategories;
    if (filters.eventCategoryId) {
      filteredCategories = eventCategories.filter(
        (ec) => ec.eventCategoryId === filters.eventCategoryId,
      );
    } else if (filters.sportId) {
      filteredCategories = eventCategories.filter(
        (ec) => (ec.category as any)?.sport?.sportId === filters.sportId,
      );
    }

    const eventCategoryIds = filteredCategories.map((ec) => ec.eventCategoryId);
    if (!eventCategoryIds.length) {
      return this.buildEmptyReport(sismasterEvent);
    }

    // 3. Registraciones
    const registrations = await this.registrationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.athlete', 'athlete')
      .leftJoinAndSelect('r.team', 'team')
      .leftJoinAndSelect('team.members', 'teamMembers')
      .leftJoinAndSelect('teamMembers.athlete', 'memberAthlete')
      .where('r.event_category_id IN (:...ids)', { ids: eventCategoryIds })
      .andWhere('r.deleted_at IS NULL')
      .getMany();

    // 4. Datos externos en paralelo
    const externalIds = [
      ...new Set(
        registrations
          .filter((r) => r.externalAthleteId)
          .map((r) => r.externalAthleteId),
      ),
    ];

    const institutionIds = [
      ...new Set(
        registrations
          .filter((r) => r.externalInstitutionId)
          .map((r) => r.externalInstitutionId),
      ),
    ];

    const [settledPersons, institutions] = await Promise.all([
      Promise.allSettled(
        externalIds.map((id) => this.sismasterService.getAthleteById(id)),
      ),
      this.sismasterService.getInstitutionsByIds(institutionIds),
    ]);

    const personMap: Record<number, any> = {};
    externalIds.forEach((id, i) => {
      if (settledPersons[i].status === 'fulfilled')
        personMap[id] = (
          settledPersons[i] as PromiseFulfilledResult<any>
        ).value;
    });

    const institutionMap: Record<number, any> = {};
    institutions.forEach((inst) => {
      institutionMap[inst.idinstitution] = inst;
    });

    // 5. Fases
    const phaseQuery = this.phaseRepo
      .createQueryBuilder('p')
      .where('p.event_category_id IN (:...ids)', { ids: eventCategoryIds })
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.display_order', 'ASC');

    if (filters.phaseId) {
      phaseQuery.andWhere('p.phase_id = :phaseId', {
        phaseId: filters.phaseId,
      });
    }

    const phases = await phaseQuery.getMany();
    const phaseIds = phases.map((p) => p.phaseId);

    // 6. Matches con participaciones
    const matches = phaseIds.length
      ? await this.matchRepo
          .createQueryBuilder('m')
          .leftJoinAndSelect('m.participations', 'participation')
          .where('m.phase_id IN (:...phaseIds)', { phaseIds })
          .andWhere('m.deleted_at IS NULL')
          .orderBy('m.phase_id', 'ASC')
          .addOrderBy('m.match_number', 'ASC')
          .getMany()
      : [];

    // 7. MatchGames (rondas/sets) para todos los matches encontrados
    const matchIds = matches.map((m) => m.matchId);

    const matchGames = matchIds.length
      ? await this.matchGameRepo
          .createQueryBuilder('mg')
          .where('mg.match_id IN (:...matchIds)', { matchIds })
          .orderBy('mg.match_id', 'ASC')
          .addOrderBy('mg.game_number', 'ASC')
          .getMany()
      : [];

    // 8. Standings + ManualRanks + PhaseRegistrations en paralelo
    const [standings, manualRanks, phaseRegs] = phaseIds.length
      ? await Promise.all([
          this.standingRepo
            .createQueryBuilder('s')
            .where('s.phase_id IN (:...phaseIds)', { phaseIds })
            .orderBy('s.rank_position', 'ASC')
            .getMany(),
          this.phaseManualRankRepo
            .createQueryBuilder('mr')
            .where('mr.phase_id IN (:...phaseIds)', { phaseIds })
            .andWhere('mr.manual_rank_position IS NOT NULL')
            .orderBy('mr.manual_rank_position', 'ASC')
            .getMany(),
          this.phaseRegistrationRepo
            .createQueryBuilder('pr')
            .where('pr.phase_id IN (:...phaseIds)', { phaseIds })
            .getMany(),
        ])
      : [[], [] as PhaseManualRank[], [] as PhaseRegistration[]];
    // 9. Scores de Poomsae y Tiro Deportivo
    // Obtener todas las participaciones de los matches de las fases
    const allParticipationIds = matches.flatMap((m) =>
      (m.participations ?? []).map((p) => p.participationId),
    );

    const [individualScores, shootingScores] = allParticipationIds.length
      ? await Promise.all([
          this.individualScoreRepo.find({
            where: allParticipationIds.map((id) => ({ participationId: id })),
          }),
          this.shootingScoreRepo.find({
            where: allParticipationIds.map((id) => ({ participationId: id })),
          }),
        ])
      : [[], []];

    const individualScoresByParticipationId = this.groupBy(
      individualScores,
      'participationId',
    );
    const shootingScoresByParticipationId = this.groupBy(
      shootingScores,
      'participationId',
    );

    // ── Mapas de búsqueda ────────────────────────────────────────────────────
    const regMap = this.buildRegistrationMap(
      registrations,
      personMap,
      institutionMap,
    );
    const athleteIdToRegId = this.buildAthleteIdToRegIdMap(registrations);
    const teamMemberMap = this.buildAthleteIdToTeamMemberMap(registrations);
    const matchesByPhaseId = this.groupBy(matches, 'phaseId');
    const gamesByMatchId = this.groupBy(matchGames, 'matchId');
    const standingsByPhaseId = this.groupBy(standings, 'phaseId');
    const manualRanksByPhaseId = this.groupBy(manualRanks, 'phaseId');
    const phaseRegsByPhaseId = this.groupBy(phaseRegs, 'phaseId');
    const phasesByEcId = this.groupBy(phases, 'eventCategoryId');
    const regsByEcId = this.groupBy(registrations, 'eventCategoryId');

    // ── Atletismo: secciones, entries y resultados ──────────────────────────
    const athleticsPhaseIds = phases
      .filter((p) =>
        ATHLETICS_PHASE_TYPES.includes(p.type as AthleticsPhaseType),
      )
      .map((p) => p.phaseId);

    const [athleticsSections, athleticsResults] = athleticsPhaseIds.length
      ? await Promise.all([
          this.athleticsSectionRepo.find({
            where: athleticsPhaseIds.map((id) => ({ phaseId: id })),
            order: { sortOrder: 'ASC', createdAt: 'ASC' },
          }),
          this.athleticsResultRepo
            .createQueryBuilder('ar')
            .innerJoin('ar.phaseRegistration', 'pr')
            .where('pr.phase_id IN (:...ids)', { ids: athleticsPhaseIds })
            .orderBy('ar.phaseRegistrationId', 'ASC')
            .addOrderBy('ar.attemptNumber', 'ASC')
            .getMany(),
        ])
      : [[], []];

    const athleticsSectionIds = athleticsSections.map(
      (s) => s.athleticsSectionId,
    );

    const athleticsEntries = athleticsSectionIds.length
      ? await this.athleticsSectionEntryRepo.find({
          where: athleticsSectionIds.map((id) => ({ athleticsSectionId: id })),
        })
      : [];

    // Mapas para lookup rápido
    const athleticsSectionsByPhaseId = this.groupBy(
      athleticsSections,
      'phaseId',
    );
    const athleticsEntriesBySectionId = this.groupBy(
      athleticsEntries,
      'athleticsSectionId',
    );
    const athleticsResultsByPrId = this.groupBy(
      athleticsResults,
      'phaseRegistrationId',
    );

    const timedSportEcIds = new Set(
     filteredCategories
       .filter((ec) => {
         const sn = (ec.category as any)?.sport?.name?.toLowerCase() ?? '';
         return (
           sn.includes('natación') ||
           sn.includes('natacion') ||
           sn.includes('ciclismo')
         );
       })
       .map((ec) => ec.eventCategoryId),
   );

   const swimmingPhaseIds = phases
     .filter((p) => timedSportEcIds.has(p.eventCategoryId))
     .map((p) => p.phaseId);

   const swimmingResults = swimmingPhaseIds.length
    ? await this.resultRepo
        .createQueryBuilder('r')
        .where('r.phase_id IN (:...ids)', { ids: swimmingPhaseIds })
        .andWhere(
          '(r.time_value IS NOT NULL OR r.notes LIKE :dns)',
          { dns: '%DNS%' },
        )
        .orderBy(
          'CASE WHEN r.rank_position IS NULL THEN 1 ELSE 0 END',
          'ASC',
        )
        .addOrderBy('r.rank_position', 'ASC')
        .addOrderBy('r.time_value', 'ASC')
        .getMany()
    : [];

   // Cargar participaciones para obtener registrationId
   const swimmingParticipationIds = [
     ...new Set(
       swimmingResults.map((r) => r.participationId).filter(Boolean),
     ),
   ];

   const swimmingParticipations = swimmingParticipationIds.length
     ? await this.participationRepo.find({
         where: swimmingParticipationIds.map((id) => ({ participationId: id })),
       })
     : [];

   const swimmingParticipationToRegId = new Map<number, number>(
    swimmingParticipations
      .filter((p) => p.registrationId != null)
      .map((p) => [p.participationId, p.registrationId as number]),
  );


   const swimmingResultsByPhaseId = this.groupBy(swimmingResults, 'phaseId');

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        version: '2.0',
        source: 'competition-system',
      },
      event: this.buildEventInfo(sismasterEvent),
      sports: this.buildSports(
        filteredCategories,
        regsByEcId,
        regMap,
        athleteIdToRegId,
        teamMemberMap,
        phasesByEcId,
        matchesByPhaseId,
        gamesByMatchId,
        standingsByPhaseId,
        manualRanksByPhaseId,
        phaseRegsByPhaseId,
        individualScoresByParticipationId,
        shootingScoresByParticipationId,
        athleticsSectionsByPhaseId,
        athleticsEntriesBySectionId,
        athleticsResultsByPrId,
        swimmingResultsByPhaseId,          
        swimmingParticipationToRegId,
      ),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILDERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────

  private buildEventInfo(event: EventSismasterDto) {
    return {
      sismasterEventId: event.idevent,
      name: event.name,
      startDate: event.startdate,
      endDate: event.enddate,
      place: event.place ?? null,
      logo: event.logo ?? null,
      modality: event.modality ?? null,
      tipo: event.tipo ?? null,
      level: event.level ?? null,
    };
  }

  private buildSports(
    eventCategories: EventCategory[],
    regsByEcId: Record<number, Registration[]>,
    regMap: Record<number, any>,
    athleteIdToRegId: Record<number, number>,
    teamMemberMap: Record<number, any>,
    phasesByEcId: Record<number, Phase[]>,
    matchesByPhaseId: Record<number, Match[]>,
    gamesByMatchId: Record<number, MatchGame[]>,
    standingsByPhaseId: Record<number, Standing[]>,
    manualRanksByPhaseId: Record<number, PhaseManualRank[]>,
    phaseRegsByPhaseId: Record<number, PhaseRegistration[]>,
    individualScoresByParticipationId: Record<number, IndividualScore[]>,
    shootingScoresByParticipationId: Record<number, ShootingScore[]>,
    athleticsSectionsByPhaseId: Record<number, AthleticsSection[]>,
    athleticsEntriesBySectionId: Record<number, AthleticsSectionEntry[]>,
    athleticsResultsByPrId: Record<number, AthleticsResult[]>,
    swimmingResultsByPhaseId:       Record<number, Result[]>,        
    swimmingParticipationToRegId:   Map<number, number>,
  ) {
    const sportMap: Record<string, any> = {};

    for (const ec of eventCategories) {
      const sport = (ec.category as any)?.sport;
      const sportKey = String(sport?.sportId ?? 'sin_deporte');

      if (!sportMap[sportKey]) {
        sportMap[sportKey] = {
          sportId: sport?.sportId ?? null,
          sportName: sport?.name ?? 'Sin deporte',
          sportCode: sport?.code ?? null,
          formatType: sport?.formatType ?? null,
          totalParticipants: 0,
          participants: [],
          categories: [],
        };
      }

      const regsForCategory = regsByEcId[ec.eventCategoryId] ?? [];
      const phasesForCategory = phasesByEcId[ec.eventCategoryId] ?? [];

      // Acumular participantes únicos a nivel deporte
      const seenRegIds = new Set<number>(
        sportMap[sportKey].participants.map((p: any) => p.registrationId),
      );
      for (const reg of regsForCategory) {
        if (!seenRegIds.has(reg.registrationId)) {
          const mapped = regMap[reg.registrationId];
          if (mapped) {
            sportMap[sportKey].participants.push(mapped);
            seenRegIds.add(reg.registrationId);
          }
        }
      }
      sportMap[sportKey].totalParticipants =
        sportMap[sportKey].participants.length;

      // ── Flags de detección calculados aquí donde sí tenemos sport/category ──
      const sportName = sport?.name?.toLowerCase() ?? '';
      const categoryName = (ec.category as any)?.name?.toLowerCase() ?? '';
      const resultType = (ec.category as any)?.resultType ?? null;

      const isPoomsae =
        // Taekwondo con resultType "score" → es Poomsae (no Kyorugui que es "combat")
        (sportName.includes('taekwondo') && resultType === 'score') ||
        // Wushu Taolu también usa score table
        (sportName.includes('wushu') && resultType === 'score') ||
        // Fallback por nombre de categoría
        categoryName.includes('poomsae') ||
        categoryName.includes('formas') ||
        categoryName.includes('forma');

      const isClimbing =
        sportName.includes('escalada') ||
        sportName.includes('climbing') ||
        sportName.includes('boulder');

      const isShooting =
        sportName.includes('tiro deportivo') ||
        sportName.includes('tiro al blanco') ||
        sportName.includes('shooting');

      const isTimedSport =
        sportName.includes('natación') ||
        sportName.includes('natacion') ||
        sportName.includes('ciclismo');


      const isWrestling =
        sportName.includes('lucha olímpica') ||
        sportName.includes('lucha olimpica') ||
        sportName.includes('wrestling');
      // ─────────────────────────────────────────────────────────────────────

      sportMap[sportKey].categories.push({
        eventCategoryId: ec.eventCategoryId,
        categoryId: ec.categoryId,
        categoryName: (ec.category as any)?.name ?? null,
        gender: (ec.category as any)?.gender ?? null,
        ageGroup: (ec.category as any)?.ageGroup ?? null,
        resultType,
        status: ec.status,
        totalParticipants: regsForCategory.length,
        participants: regsForCategory
          .map((r) => regMap[r.registrationId])
          .filter(Boolean),
        phases: phasesForCategory.map((phase) =>
          this.buildPhase(
            phase,
            matchesByPhaseId,
            gamesByMatchId,
            standingsByPhaseId,
            manualRanksByPhaseId,
            phaseRegsByPhaseId,
            regMap,
            athleteIdToRegId,
            teamMemberMap,
            individualScoresByParticipationId,
            shootingScoresByParticipationId,
            isPoomsae,
            isShooting,
            isClimbing,
            isTimedSport,
            isWrestling,
            swimmingResultsByPhaseId[phase.phaseId] ?? [], 
            swimmingParticipationToRegId,
            athleticsSectionsByPhaseId[phase.phaseId] ?? [],
            athleticsEntriesBySectionId,
            athleticsResultsByPrId,
            phaseRegsByPhaseId[phase.phaseId] ?? [],
          ),
        ),
      });
    }

    return Object.values(sportMap);
  }

  private buildPhase(
    phase: Phase,
    matchesByPhaseId: Record<number, Match[]>,
    gamesByMatchId: Record<number, MatchGame[]>,
    standingsByPhaseId: Record<number, Standing[]>,
    manualRanksByPhaseId: Record<number, PhaseManualRank[]>,
    phaseRegsByPhaseId: Record<number, PhaseRegistration[]>,
    regMap: Record<number, any>,
    athleteIdToRegId: Record<number, number>,
    teamMemberMap: Record<number, any>,
    individualScoresByParticipationId: Record<number, IndividualScore[]>,
    shootingScoresByParticipationId: Record<number, ShootingScore[]>,
    isPoomsae: boolean,
    isShooting: boolean,
    isClimbing: boolean,
    isTimedSport: boolean,                         
    isWrestling: boolean,  
    swimmingResultsForPhase: Result[],               
    swimmingParticipationToRegId: Map<number, number>,
    athleticsSectionsForPhase: AthleticsSection[],
    athleticsEntriesBySectionId: Record<number, AthleticsSectionEntry[]>,
    athleticsResultsByPrId: Record<number, AthleticsResult[]>,
    phaseRegsForAthletics: PhaseRegistration[],
  ) {
    const phaseMatches = matchesByPhaseId[phase.phaseId] ?? [];
    const phaseStandings = standingsByPhaseId[phase.phaseId] ?? [];
    const phaseManualRanks = manualRanksByPhaseId[phase.phaseId] ?? [];
    const phaseRegs = phaseRegsByPhaseId[phase.phaseId] ?? [];

    if (ATHLETICS_PHASE_TYPES.includes(phase.type as AthleticsPhaseType)) {
      return this.buildAthleticsPhase(
        phase,
        phaseRegsForAthletics,
        regMap,
        athleticsSectionsForPhase,
        athleticsEntriesBySectionId,
        athleticsResultsByPrId,
      );
    }

    if (isClimbing && phase.type === 'grupo') {
      return this.buildClimbingPhase(
        phase,
        phaseMatches,
        regMap,
        individualScoresByParticipationId,
      );
    }

    if (isWrestling && phase.type === 'grupo') {
      return this.buildWrestlingPhase(phase, phaseMatches, regMap);
    }

    if (isTimedSport) {
      return this.buildSwimmingPhase(
        phase,
        swimmingResultsForPhase,
        swimmingParticipationToRegId,
        regMap,
      );
    }


    // ── Participantes de la fase ──────────────────────────────────────────
    let participantIds: number[];

    if (phaseRegs.length > 0) {
      participantIds = phaseRegs.map((pr) => pr.registrationId);
    } else {
      const ids = new Set<number>();
      for (const match of phaseMatches) {
        for (const p of match.participations ?? []) {
          if (p.registrationId != null) ids.add(p.registrationId);
        }
      }
      participantIds = [...ids];
    }

    const phaseParticipants = [...new Set(participantIds)]
      .map((rid) => regMap[rid] ?? { registrationId: rid })
      .sort((a, b) => (a.seedNumber ?? 999) - (b.seedNumber ?? 999));

    // ── Score Table (Poomsae / Tiro Deportivo) ────────────────────────────
    let scoreTable: any[] | null = null;

    if (isPoomsae || isShooting) {
      const rows: any[] = [];

      for (const match of phaseMatches) {
        for (const participation of match.participations ?? []) {
          const athlete =
            participation.registrationId != null
              ? (regMap[participation.registrationId] ?? {
                  registrationId: participation.registrationId,
                })
              : null;

          if (isPoomsae) {
            const scores =
              individualScoresByParticipationId[
                participation.participationId
              ] ?? [];
            const score = scores[0] ?? null;
            rows.push({
              participationId: participation.participationId,
              registrationId: participation.registrationId ?? null,
              athlete,
              accuracy: score?.accuracy != null ? Number(score.accuracy) : null,
              presentation:
                score?.presentation != null ? Number(score.presentation) : null,
              total: score?.total != null ? Number(score.total) : null,
              rank: score?.rank ?? null,
            });
          }

          if (isShooting) {
            const scores =
              shootingScoresByParticipationId[participation.participationId] ??
              [];
            const score = scores[0] ?? null;
            rows.push({
              participationId: participation.participationId,
              registrationId: participation.registrationId ?? null,
              athlete,
              series: score?.series ?? [],
              total: score?.total != null ? Number(score.total) : null,
              dns: score?.dns ?? false,
              rank: score?.rank ?? null,
            });
          }
        }
      }

      // Ordenar por rank ascendente, nulls al final
      scoreTable = rows.sort((a, b) => {
        if (a.rank == null && b.rank == null) return 0;
        if (a.rank == null) return 1;
        if (b.rank == null) return -1;
        return a.rank - b.rank;
      });
    }

    // ── Podio ─────────────────────────────────────────────────────────────
    let podium: any[];

    if (isPoomsae || isShooting) {
      // Para estas disciplinas el podio se deriva del scoreTable ya ordenado
      podium = (scoreTable ?? [])
        .filter((row) => row.rank != null)
        .slice(0, 3)
        .map((row) => ({
          rank: row.rank,
          athlete: row.athlete,
          ...(isPoomsae && {
            accuracy: row.accuracy,
            presentation: row.presentation,
            total: row.total,
          }),
          ...(isShooting && {
            series: row.series,
            total: row.total,
            dns: row.dns,
          }),
        }));
    } else if (phaseManualRanks.length > 0) {
      podium = phaseManualRanks.map((mr) => ({
        rank: mr.manualRankPosition,
        athlete: regMap[mr.registrationId] ?? {
          registrationId: mr.registrationId,
        },
      }));
    } else {
      podium = phaseStandings
        .map((s) => ({
          rank: s.manualRankPosition ?? s.rankPosition ?? null,
          matchesPlayed: s.matchesPlayed,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          points: Number(s.points),
          scoreFor: s.scoreFor,
          scoreAgainst: s.scoreAgainst,
          athlete: regMap[s.registrationId] ?? {
            registrationId: s.registrationId,
          },
        }))
        .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
    }

    return {
      phaseId: phase.phaseId,
      phaseName: phase.name ?? null,
      phaseType: phase.type ?? null,
      displayOrder: phase.displayOrder ?? null,
      isPoomsae,
      isShooting,
      totalParticipants: phaseParticipants.length,
      totalBrackets: this.countUniqueBrackets(phaseMatches),
      participants: phaseParticipants,
      brackets: this.buildBrackets(
        phaseMatches,
        gamesByMatchId,
        regMap,
        athleteIdToRegId,
        teamMemberMap,
      ),
      scoreTable,
      podium,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BRACKET BUILDERS
  // ─────────────────────────────────────────────────────────────────────────

  private buildBrackets(
    matches: Match[],
    gamesByMatchId: Record<number, MatchGame[]>,
    regMap: Record<number, any>,
    athleteIdToRegId: Record<number, number>,
    teamMemberMap: Record<number, any>,
  ): any[] {
    const standalone = matches.filter((m) => !m.seriesId);
    const inSeries = matches.filter((m) => m.seriesId);

    const seriesMap: Record<string, Match[]> = {};
    for (const m of inSeries) {
      if (!seriesMap[m.seriesId]) seriesMap[m.seriesId] = [];
      seriesMap[m.seriesId].push(m);
    }

    const result: any[] = [
      ...standalone.map((m) =>
        this.buildBracket(
          m,
          gamesByMatchId[m.matchId] ?? [],
          regMap,
          athleteIdToRegId,
          teamMemberMap,
        ),
      ),
      ...Object.entries(seriesMap).map(([seriesId, seriesMatches]) =>
        this.buildSeriesBracket(
          seriesId,
          seriesMatches,
          gamesByMatchId,
          regMap,
          athleteIdToRegId,
          teamMemberMap,
        ),
      ),
    ];

    return result.sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));
  }

  /**
   * Match individual (con o sin rondas en match_games).
   * Usado por: Taekwondo, Judo, Karate, Poomsae, Lucha, etc.
   * Si tiene MatchGames → rounds[] aparece con el detalle por ronda.
   * Si no tiene MatchGames → rounds: null (deportes de score único).
   */
  private buildBracket(
    match: Match,
    games: MatchGame[],
    regMap: Record<number, any>,
    athleteIdToRegId: Record<number, number>,
    teamMemberMap: Record<number, any>,
  ) {
    const p1Score =
      match.participant1Score != null
        ? Number(match.participant1Score)
        : games.length > 0
          ? games.reduce((sum, g) => sum + (g.score1 ?? 0), 0)
          : null;

    const p2Score =
      match.participant2Score != null
        ? Number(match.participant2Score)
        : games.length > 0
          ? games.reduce((sum, g) => sum + (g.score2 ?? 0), 0)
          : null;

    return {
      bracketId: match.matchId,
      isSeries: false,
      matchNumber: match.matchNumber ?? null,
      round: match.round ?? null,
      status: match.status,
      scheduledTime: match.scheduledTime ?? null,
      platformNumber: match.platformNumber ?? null,
      isWalkover: match.isWalkover,
      walkoverReason: match.walkoverReason ?? null,
      victoryType: match.victoryType ?? null,
      participants: (match.participations ?? []).map((p) => ({
        participationId: p.participationId,
        corner: p.corner ?? null,
        athlete:
          p.registrationId != null
            ? (regMap[p.registrationId] ?? { registrationId: p.registrationId })
            : null,
      })),
      scores: {
        participant1: {
          score: p1Score,
          accuracy:
            match.participant1Accuracy != null
              ? Number(match.participant1Accuracy)
              : null,
          presentation:
            match.participant1Presentation != null
              ? Number(match.participant1Presentation)
              : null,
        },
        participant2: {
          score: p2Score,
          accuracy:
            match.participant2Accuracy != null
              ? Number(match.participant2Accuracy)
              : null,
          presentation:
            match.participant2Presentation != null
              ? Number(match.participant2Presentation)
              : null,
        },
      },
      winner: match.winnerRegistrationId
        ? (regMap[match.winnerRegistrationId] ?? {
            registrationId: match.winnerRegistrationId,
          })
        : null,
      rounds:
        games.length > 0
          ? games.map((g) =>
              this.buildRound(g, regMap, athleteIdToRegId, teamMemberMap),
            )
          : null,
    };
  }

  private buildAthleteIdToRegIdMap(
    registrations: Registration[],
  ): Record<number, number> {
    const map: Record<number, number> = {};
    for (const reg of registrations) {
      const athleteId = (reg.athlete as any)?.athleteId;
      if (athleteId != null) {
        map[athleteId] = reg.registrationId;
      }
    }
    return map;
  }

  private buildAthleteIdToTeamMemberMap(
    registrations: Registration[],
  ): Record<number, any> {
    const map: Record<number, any> = {};

    for (const reg of registrations) {
      if (!reg.team) continue;
      const members = (reg.team as any).members ?? [];

      for (const member of members) {
        if (member.athleteId == null) continue;
        map[member.athleteId] = {
          athleteId: member.athleteId,
          tmId: member.tmId,
          rol: member.rol ?? null,
          name: member.athlete?.name ?? null,
          photoUrl: member.athlete?.photoUrl ?? null,
          teamId: reg.teamId,
          teamName: (reg.team as any).name ?? null,
          registrationId: reg.registrationId,
        };
      }
    }

    return map;
  }

  /**
   * Serie de matches agrupados por seriesId.
   * Usado por: deportes con "mejor de N" donde cada match es una fila separada.
   * Cada match de la serie puede tener sus propios match_games internos.
   */
  private buildSeriesBracket(
    seriesId: string,
    matches: Match[],
    gamesByMatchId: Record<number, MatchGame[]>,
    regMap: Record<number, any>,
    athleteIdToRegId: Record<number, number>,
    teamMemberMap: Record<number, any>,
  ) {
    const sorted = [...matches].sort(
      (a, b) => (a.seriesMatchNumber ?? 0) - (b.seriesMatchNumber ?? 0),
    );
    const first = sorted[0];

    const participants = (first.participations ?? []).map((p) => ({
      participationId: p.participationId,
      corner: p.corner ?? null,
      athlete:
        p.registrationId != null
          ? (regMap[p.registrationId] ?? { registrationId: p.registrationId })
          : null,
    }));

    const seriesWinnerId = first.seriesWinnerRegistrationId ?? null;
    const seriesScore = this.resolveSeriesScore(
      sorted,
      first.participations ?? [],
    );

    return {
      bracketId: null,
      isSeries: true,
      seriesId,
      matchNumber: first.matchNumber ?? null,
      round: first.round ?? null,
      status: this.resolveSeriesStatus(sorted),
      scheduledTime: first.scheduledTime ?? null,
      platformNumber: first.platformNumber ?? null,
      participants,
      seriesScore,
      rounds: sorted.map((m) => ({
        roundNumber: m.seriesMatchNumber ?? null,
        matchId: m.matchId,
        status: m.status,
        isWalkover: m.isWalkover,
        walkoverReason: m.walkoverReason ?? null,
        victoryType: m.victoryType ?? null,
        scores: {
          participant1: {
            score:
              m.participant1Score != null ? Number(m.participant1Score) : null,
            accuracy:
              m.participant1Accuracy != null
                ? Number(m.participant1Accuracy)
                : null,
            presentation:
              m.participant1Presentation != null
                ? Number(m.participant1Presentation)
                : null,
          },
          participant2: {
            score:
              m.participant2Score != null ? Number(m.participant2Score) : null,
            accuracy:
              m.participant2Accuracy != null
                ? Number(m.participant2Accuracy)
                : null,
            presentation:
              m.participant2Presentation != null
                ? Number(m.participant2Presentation)
                : null,
          },
        },
        winner: m.winnerRegistrationId
          ? (regMap[m.winnerRegistrationId] ?? {
              registrationId: m.winnerRegistrationId,
            })
          : null,
        games:
          (gamesByMatchId[m.matchId] ?? []).length > 0
            ? (gamesByMatchId[m.matchId] ?? []).map((g) =>
                this.buildRound(g, regMap, athleteIdToRegId, teamMemberMap),
              )
            : null,
      })),
      seriesWinner: seriesWinnerId
        ? (regMap[seriesWinnerId] ?? { registrationId: seriesWinnerId })
        : null,
    };
  }

  /**
   * Construye una ronda/set individual desde MatchGame.
   * El winnerId en MatchGame almacena registrationId (ver taekwondo-kyorugui.service.ts).
   */
  private buildRound(
    game: MatchGame,
    regMap: Record<number, any>,
    athleteIdToRegId: Record<number, number>,
    teamMemberMap: Record<number, any>,
  ) {
    const resolveParticipant = (id: number | null) => {
      if (id == null) return null;
      // 1. Directo en regMap (registrationId)
      if (regMap[id]) return regMap[id];
      // 2. athleteId individual → registrationId
      const regId = athleteIdToRegId[id];
      if (regId && regMap[regId]) return regMap[regId];
      // 3. athleteId de miembro de equipo → info del miembro
      if (teamMemberMap[id]) return teamMemberMap[id];
      return { athleteId: id };
    };

    return {
      roundNumber: game.gameNumber,
      status: game.status,
      scores: {
        participant1: { score: game.score1 ?? null },
        participant2: { score: game.score2 ?? null },
      },
      sets: game.sets
        ? game.sets.map((s) => ({
            setNumber: s.setNumber,
            player1Score: s.player1Score,
            player2Score: s.player2Score,
            winner: resolveParticipant(s.winnerId ?? null),
          }))
        : null,
      winner: resolveParticipant(game.winnerId),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SERIES HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private resolveSeriesStatus(matches: Match[]): MatchStatus {
    if (matches.every((m) => m.status === MatchStatus.FINALIZADO))
      return MatchStatus.FINALIZADO;
    if (matches.some((m) => m.status === MatchStatus.EN_CURSO))
      return MatchStatus.EN_CURSO;
    return MatchStatus.PROGRAMADO;
  }

  private resolveSeriesScore(
    matches: Match[],
    firstParticipations: { registrationId?: number | null }[],
  ): { participant1Wins: number; participant2Wins: number } {
    const [p1, p2] = firstParticipations.map((p) => p.registrationId ?? null);
    let p1Wins = 0;
    let p2Wins = 0;

    for (const m of matches) {
      if (m.winnerRegistrationId == null) continue;
      if (m.winnerRegistrationId === p1) p1Wins++;
      else if (m.winnerRegistrationId === p2) p2Wins++;
    }

    return { participant1Wins: p1Wins, participant2Wins: p2Wins };
  }

  private countUniqueBrackets(matches: Match[]): number {
    const seriesIds = new Set(
      matches.filter((m) => m.seriesId).map((m) => m.seriesId),
    );
    const standaloneCount = matches.filter((m) => !m.seriesId).length;
    return standaloneCount + seriesIds.size;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private buildRegistrationMap(
    registrations: Registration[],
    personMap: Record<number, any>,
    institutionMap: Record<number, any> = {},
  ): Record<number, any> {
    const map: Record<number, any> = {};

    for (const reg of registrations) {
      const person = reg.externalAthleteId
        ? personMap[reg.externalAthleteId]
        : null;
      const institution = reg.externalInstitutionId
        ? institutionMap[reg.externalInstitutionId]
        : null;

      let athleteInfo: any = null;

      if (person) {
        athleteInfo = {
          source: 'sismaster',
          personId: reg.externalAthleteId,
          fullName: [person.lastname, person.surname, person.firstname]
            .filter(Boolean)
            .join(' '),
          document: person.docnumber ?? null,
          gender: person.gender ?? null,
          birthDate: person.birthday ?? null,
          institution: {
            id: reg.externalInstitutionId ?? null,
            name: institution?.businessName ?? institution?.business ?? null,
          },
        };
      } else if (reg.athlete) {
        athleteInfo = {
          source: 'local',
          personId: null,
          fullName: [
            (reg.athlete as any).lastName,
            (reg.athlete as any).firstName,
          ]
            .filter(Boolean)
            .join(', '),
          document: (reg.athlete as any).docNumber ?? null,
          gender: (reg.athlete as any).gender ?? null,
          birthDate: (reg.athlete as any).birthDate ?? null,
          institution: null,
        };
      } else if (reg.team) {
        const members = ((reg.team as any).members ?? []).map((m: any) => ({
          tmId: m.tmId,
          athleteId: m.athleteId,
          rol: m.rol ?? null,
          name: m.athlete?.name ?? null,
          photoUrl: m.athlete?.photoUrl ?? null,
        }));

        athleteInfo = {
          source: 'team',
          teamId: reg.teamId,
          teamName: (reg.team as any).name ?? null,
          members,
        };
      }

      map[reg.registrationId] = {
        registrationId: reg.registrationId,
        seedNumber: reg.seedNumber ?? null,
        weightClass: reg.weightClass ?? null,
        externalAthleteId: reg.externalAthleteId ?? null,
        externalInstitutionId: reg.externalInstitutionId ?? null,
        externalAccreditationId: reg.externalAccreditationId ?? null,
        athlete: athleteInfo,
      };
    }

    return map;
  }

  private groupBy<T>(items: T[], key: string): Record<number, T[]> {
    const map: Record<number, T[]> = {};
    for (const item of items) {
      const k = (item as any)[key];
      if (!map[k]) map[k] = [];
      map[k].push(item);
    }
    return map;
  }

  private buildEmptyReport(event: EventSismasterDto) {
    return {
      meta: {
        generatedAt: new Date().toISOString(),
        version: '2.0',
        source: 'competition-system',
      },
      event: this.buildEventInfo(event),
      sports: [],
    };
  }

  private buildAthleticsPhase(
    phase: Phase,
    phaseRegs: PhaseRegistration[],
    regMap: Record<number, any>,
    sections: AthleticsSection[],
    entriesBySectionId: Record<number, AthleticsSectionEntry[]>,
    resultsByPrId: Record<number, AthleticsResult[]>,
  ) {
    const base = {
      phaseId: phase.phaseId,
      phaseName: phase.name ?? null,
      phaseType: phase.type ?? null,
      displayOrder: phase.displayOrder ?? null,
      isAtletismo: true,
    };

    switch (phase.type as AthleticsPhaseType) {
      case 'combined_pista':
        return {
          ...base,
          athleticsType: 'pista',
          ...this._buildTrackPhase(
            phaseRegs,
            regMap,
            sections,
            entriesBySectionId,
          ),
        };
      case 'combined_distancia':
        return {
          ...base,
          athleticsType: 'distancia',
          ...this._buildDistancePhase(phaseRegs, regMap, resultsByPrId),
        };
      case 'combined_altura':
        return {
          ...base,
          athleticsType: 'altura',
          ...this._buildHeightPhase(phaseRegs, regMap, resultsByPrId),
        };
    }
  }

  // ── Pista: secciones con carriles y tiempos ───────────────────────────────

  private _buildTrackPhase(
    phaseRegs: PhaseRegistration[],
    regMap: Record<number, any>,
    sections: AthleticsSection[],
    entriesBySectionId: Record<number, AthleticsSectionEntry[]>,
  ) {
    const prMap = new Map(phaseRegs.map((pr) => [pr.phaseRegistrationId, pr]));

    const sectionData = sections.map((section) => {
      const entries = entriesBySectionId[section.athleticsSectionId] ?? [];

      // Ordenar: tiempos válidos ascendente → status → sin resultado
      const sorted = [...entries].sort((a, b) => {
        const stA = this._isRaceStatus(a.notes);
        const stB = this._isRaceStatus(b.notes);
        const tA = this._parseTimeMs(a.time);
        const tB = this._parseTimeMs(b.time);
        if (!stA && tA !== null && !stB && tB !== null) return tA - tB;
        if (!stA && tA !== null) return -1;
        if (!stB && tB !== null) return 1;
        return 0;
      });

      let posCounter = 0;
      const athletes = sorted.map((entry) => {
        const pr = prMap.get(entry.phaseRegistrationId);
        const regId = pr?.registrationId ?? null;
        const status = this._isRaceStatus(entry.notes) ? entry.notes : null;
        const hasTime = !status && !!entry.time;
        if (hasTime) posCounter++;

        return {
          pos: hasTime ? posCounter : null,
          lane: entry.lane ?? null,
          registrationId: regId,
          athlete:
            regId != null ? (regMap[regId] ?? { registrationId: regId }) : null,
          time: entry.time ?? null,
          wind: entry.wind != null ? Number(entry.wind) : null,
          status, // "DNF" | "DNS" | "DQ" | null
        };
      });

      return {
        sectionId: section.athleticsSectionId,
        sectionName: section.name,
        sortOrder: section.sortOrder,
        wind: section.wind != null ? Number(section.wind) : null,
        totalAthletes: athletes.length,
        athletes,
      };
    });

    // Atletas sin sección asignada
    const assignedPrIds = new Set(
      sections.flatMap((s) =>
        (entriesBySectionId[s.athleticsSectionId] ?? []).map(
          (e) => e.phaseRegistrationId,
        ),
      ),
    );
    const unassigned = phaseRegs
      .filter((pr) => !assignedPrIds.has(pr.phaseRegistrationId))
      .map((pr) => ({
        pos: null,
        lane: null,
        registrationId: pr.registrationId,
        athlete: regMap[pr.registrationId] ?? {
          registrationId: pr.registrationId,
        },
        time: null,
        wind: null,
        status: null,
      }));

    return {
      totalParticipants: phaseRegs.length,
      sections: sectionData,
      unassigned,
    };
  }

  // ── Distancia: saltos y lanzamientos ─────────────────────────────────────

  private _buildDistancePhase(
    phaseRegs: PhaseRegistration[],
    regMap: Record<number, any>,
    resultsByPrId: Record<number, AthleticsResult[]>,
  ) {
    const rows = phaseRegs.map((pr) => {
      const attempts = resultsByPrId[pr.phaseRegistrationId] ?? [];

      // Status global del atleta (todos los intentos con el mismo status)
      const globalStatus = this._resolveAthleteStatus(attempts);

      // Mejor intento válido
      const validAttempts = attempts.filter(
        (a) =>
          a.isValid && a.distanceValue != null && !this._isRaceStatus(a.notes),
      );
      const bestDistance =
        validAttempts.length > 0
          ? Math.max(...validAttempts.map((a) => Number(a.distanceValue)))
          : null;

      return {
        registrationId: pr.registrationId,
        athlete: regMap[pr.registrationId] ?? {
          registrationId: pr.registrationId,
        },
        bestDistance,
        status: globalStatus,
        attempts: attempts.map((a) => ({
          attemptNumber: a.attemptNumber,
          distance: a.distanceValue != null ? Number(a.distanceValue) : null,
          isValid: a.isValid,
          wind: a.wind != null ? Number(a.wind) : null,
          notes: a.notes ?? null, // "DNF" | "DNS" | "DQ" | "FOUL"(isValid=false) | null
        })),
      };
    });

    // Ordenar: mejor distancia desc → sin marca → con status
    const sorted = [...rows].sort((a, b) => {
      if (a.bestDistance !== null && b.bestDistance !== null)
        return b.bestDistance - a.bestDistance;
      if (a.bestDistance !== null) return -1;
      if (b.bestDistance !== null) return 1;
      return 0;
    });

    let posCounter = 0;
    const athletes = sorted.map((row) => {
      if (row.bestDistance !== null) posCounter++;
      return {
        pos: row.bestDistance !== null ? posCounter : null,
        ...row,
      };
    });

    return {
      totalParticipants: phaseRegs.length,
      athletes,
    };
  }

  // ── Altura: salto alto y garrocha ─────────────────────────────────────────

  private _buildHeightPhase(
    phaseRegs: PhaseRegistration[],
    regMap: Record<number, any>,
    resultsByPrId: Record<number, AthleticsResult[]>,
  ) {
    // Todas las alturas únicas del evento, ordenadas ascendente
    const allHeightsSet = new Set<number>();
    for (const pr of phaseRegs) {
      const attempts = resultsByPrId[pr.phaseRegistrationId] ?? [];
      attempts.forEach((a) => {
        if (a.height != null) allHeightsSet.add(Number(a.height));
      });
    }
    const allHeights = Array.from(allHeightsSet).sort((a, b) => a - b);

    const rows = phaseRegs.map((pr) => {
      const attempts = resultsByPrId[pr.phaseRegistrationId] ?? [];
      const globalStatus = this._resolveAthleteStatus(attempts);

      // Mejor altura superada
      const passedHeights = attempts
        .filter((a) => a.heightResult === 'O' && a.height != null)
        .map((a) => Number(a.height));
      const bestHeight =
        passedHeights.length > 0 ? Math.max(...passedHeights) : null;

      // Resultados por altura: { height → secuencia "XXO" }
      const heightMap: Record<number, string> = {};
      for (const h of allHeights) {
        const seq = attempts
          .filter((a) => Number(a.height) === h)
          .sort((a, b) => (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0))
          .map((a) => a.heightResult ?? '?')
          .join('');
        if (seq) heightMap[h] = seq;
      }

      return {
        registrationId: pr.registrationId,
        athlete: regMap[pr.registrationId] ?? {
          registrationId: pr.registrationId,
        },
        bestHeight,
        status: globalStatus,
        // Lista de alturas con su secuencia (solo las intentadas por este atleta)
        heights: allHeights
          .filter((h) => heightMap[h])
          .map((h) => ({
            height: h,
            sequence: heightMap[h], // "O" | "XO" | "XXO" | "-" | etc.
            cleared: (heightMap[h] ?? '').includes('O'),
          })),
      };
    });

    // Ordenar: mejor altura desc → sin marca → con status
    const sorted = [...rows].sort((a, b) => {
      if (a.bestHeight !== null && b.bestHeight !== null)
        return b.bestHeight - a.bestHeight;
      if (a.bestHeight !== null) return -1;
      if (b.bestHeight !== null) return 1;
      return 0;
    });

    let posCounter = 0;
    const athletes = sorted.map((row) => {
      if (row.bestHeight !== null) posCounter++;
      return {
        pos: row.bestHeight !== null ? posCounter : null,
        ...row,
      };
    });

    return {
      totalParticipants: phaseRegs.length,
      allHeights, // útil para el consumidor al construir columnas
      athletes,
    };
  }

  // ── Helpers privados de atletismo ─────────────────────────────────────────

  /** Devuelve true si el string es un status especial de carrera */
  private _isRaceStatus(notes: string | null | undefined): boolean {
    return notes === 'DNF' || notes === 'DNS' || notes === 'DQ';
  }

  /**
   * Si TODOS los intentos tienen el mismo status (DNF/DNS/DQ), lo devuelve.
   * Si alguno tiene marca válida o no hay intentos, devuelve null.
   */
  private _resolveAthleteStatus(attempts: AthleticsResult[]): string | null {
    if (attempts.length === 0) return null;
    const statuses = attempts.map((a) =>
      this._isRaceStatus(a.notes) ? a.notes : null,
    );
    const first = statuses[0];
    if (!first) return null;
    return statuses.every((s) => s === first) ? first : null;
  }

  /**
   * Convierte string de tiempo ("10.45", "1:23.45", "1:23:45.00") a ms
   * para poder ordenar carreras correctamente.
   */
  private _parseTimeMs(time: string | null): number | null {
    if (!time) return null;
    const parts = time.split(':').reverse();
    let ms = 0;
    const [secStr, minStr, hrStr] = parts;
    if (secStr) {
      const [sec, cs] = secStr.split('.');
      ms += parseInt(sec ?? '0') * 1000;
      ms += parseInt(((cs ?? '0') + '0').slice(0, 2)) * 10;
    }
    if (minStr) ms += parseInt(minStr) * 60_000;
    if (hrStr) ms += parseInt(hrStr) * 3_600_000;
    return ms;
  }

  private buildClimbingPhase(
    phase: Phase,
    phaseMatches: Match[],
    regMap: Record<number, any>,
    individualScoresByParticipationId: Record<number, IndividualScore[]>,
  ) {
    const rows: any[] = [];

    for (const match of phaseMatches) {
      for (const participation of match.participations ?? []) {
        const scores =
          individualScoresByParticipationId[participation.participationId] ??
          [];
        const score = scores[0] ?? null;

        rows.push({
          participationId: participation.participationId,
          registrationId: participation.registrationId ?? null,
          athlete:
            participation.registrationId != null
              ? (regMap[participation.registrationId] ?? {
                  registrationId: participation.registrationId,
                })
              : null,
          total: score?.total != null ? Number(score.total) : null,
          rank: score?.rank ?? null,
        });
      }
    }

    // Ordenar: rank ascendente, nulls al final
    const sorted = [...rows].sort((a, b) => {
      if (a.rank == null && b.rank == null) return 0;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      return a.rank - b.rank;
    });

    return {
      phaseId: phase.phaseId,
      phaseName: phase.name ?? null,
      phaseType: phase.type ?? null,
      displayOrder: phase.displayOrder ?? null,
      isClimbing: true,
      totalParticipants: sorted.length,
      athletes: sorted,
    };
  }

  private buildSwimmingPhase(
    phase: Phase,
    results: Result[],
    participationToRegId: Map<number, number>,
    regMap: Record<number, any>,
  ) {
    const isDQ = (r: Result) =>
      !!(r.notes && r.notes.toUpperCase().includes('DQ'));
 
    const athletes = results.map((r, idx) => {
      const registrationId =
        r.participationId != null
          ? (participationToRegId.get(r.participationId) ?? null)
          : null;

    const isDNS = !!(r.notes && r.notes.toUpperCase().includes('DNS'));
 
      return {
        pos:            (isDQ(r) || isDNS) ? null : (r.rankPosition ?? idx + 1),
        registrationId,
        athlete:
          registrationId != null
            ? (regMap[registrationId] ?? { registrationId })
            : null,
        time:           r.timeValue   ?? null,
        rankPosition:   r.rankPosition ?? null,
        isDQ:           isDQ(r),
        isDNS,
        notes:          r.notes        ?? null,
      };
    });
 
    return {
      phaseId:           phase.phaseId,
      phaseName:         phase.name         ?? null,
      phaseType:         phase.type         ?? null,
      displayOrder:      phase.displayOrder ?? null,
      isSwimming:        true,
      totalParticipants: athletes.length,
      athletes,
    };
  }

  private buildWrestlingPhase(
    phase: Phase,
    phaseMatches: Match[],
    regMap: Record<number, any>,
  ) {
    // ── Helpers CP por tipo de victoria ──────────────────────────────────
    const winnerCP = (vt: string | null): number => {
      switch (vt) {
        case 'VFA': case 'VCA': return 5;
        case 'VSU': case 'VSU1': return 4;
        case 'VPO1': case 'VPO': return 3;
        default: return 3;
      }
    };
    const loserCP = (vt: string | null): number => {
      switch (vt) {
        case 'VFA': case 'VCA': case 'VSU': return 0;
        case 'VSU1': case 'VPO1': case 'VPO': return 1;
        default: return 0;
      }
    };

    // ── Acumular estadísticas por atleta ──────────────────────────────────
    interface WrestlerRow {
      registrationId: number;
      athlete: any;
      W: number;
      CP: number;
      VT: number;
      ST: number;
      TP: number;
      TPGvn: number;
    }

    const rowMap = new Map<number, WrestlerRow>();

    const ensureRow = (regId: number): WrestlerRow => {
      if (!rowMap.has(regId)) {
        rowMap.set(regId, {
          registrationId: regId,
          athlete: regMap[regId] ?? { registrationId: regId },
          W: 0, CP: 0, VT: 0, ST: 0, TP: 0, TPGvn: 0,
        });
      }
      return rowMap.get(regId)!;
    };

    const brackets: any[] = [];

    for (const match of phaseMatches) {
      const parts = match.participations ?? [];
      const reg0 = parts[0]?.registrationId ?? null;
      const reg1 = parts[1]?.registrationId ?? null;

      const tp0 = match.participant1Score != null ? Math.floor(Number(match.participant1Score)) : 0;
      const tp1 = match.participant2Score != null ? Math.floor(Number(match.participant2Score)) : 0;
      const vt  = match.victoryType ?? null;

      if (reg0) {
        const r = ensureRow(reg0);
        r.TP    += tp0;
        r.TPGvn += tp1;
      }
      if (reg1) {
        const r = ensureRow(reg1);
        r.TP    += tp1;
        r.TPGvn += tp0;
      }

      if (match.winnerRegistrationId && reg0 && reg1) {
        const isW0 = match.winnerRegistrationId === reg0;
        const winner = isW0 ? ensureRow(reg0) : ensureRow(reg1);
        const loser  = isW0 ? ensureRow(reg1) : ensureRow(reg0);

        winner.W++;
        winner.CP += winnerCP(vt);
        loser.CP  += loserCP(vt);

        if (vt === 'VFA' || vt === 'VCA') winner.VT++;
        if (vt === 'VSU' || vt === 'VSU1') winner.ST++;
      }

      // Bracket individual para el consumidor
      brackets.push({
        matchId:     match.matchId,
        matchNumber: match.matchNumber ?? null,
        round:       match.round ?? null,
        status:      match.status,
        victoryType: vt,
        participants: parts.map((p: any) => ({
          registrationId: p.registrationId ?? null,
          athlete: p.registrationId != null
            ? (regMap[p.registrationId] ?? { registrationId: p.registrationId })
            : null,
          score: p.registrationId === reg0 ? tp0 : tp1,
          isWinner: p.registrationId === match.winnerRegistrationId,
        })),
      });
    }

    // ── Ordenar ranking: CP desc → W desc → TP desc → TPGvn asc ──────────
    const ranking = Array.from(rowMap.values())
      .sort((a, b) =>
        b.CP !== a.CP ? b.CP - a.CP :
        b.W  !== a.W  ? b.W  - a.W  :
        b.TP !== a.TP ? b.TP - a.TP :
        a.TPGvn - b.TPGvn,
      )
      .map((row, i) => ({ rank: i + 1, ...row }));

    return {
      phaseId:           phase.phaseId,
      phaseName:         phase.name         ?? null,
      phaseType:         phase.type         ?? null,
      displayOrder:      phase.displayOrder ?? null,
      isWrestling:       true,
      totalParticipants: ranking.length,
      ranking,
      brackets: brackets.sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0)),
    };
  }
  
}

