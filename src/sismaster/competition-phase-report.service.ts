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
import { SismasterService } from './sismaster.service';
import { EventSismasterDto } from './dto/event-sismaster.dto';
import { MatchStatus } from '../common/enums';

interface PhaseReportFilters {
  sportId?: number;
  eventCategoryId?: number;
  phaseId?: number;
}

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
        personMap[id] = (settledPersons[i] as PromiseFulfilledResult<any>).value;
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
      phaseQuery.andWhere('p.phase_id = :phaseId', { phaseId: filters.phaseId });
    }

    const phases   = await phaseQuery.getMany();
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

    // 7. Standings + ManualRanks + PhaseRegistrations en paralelo
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

    // ── Mapas de búsqueda ────────────────────────────────────────────────────
    const regMap               = this.buildRegistrationMap(registrations, personMap, institutionMap);
    const matchesByPhaseId     = this.groupBy(matches,     'phaseId');
    const standingsByPhaseId   = this.groupBy(standings,   'phaseId');
    const manualRanksByPhaseId = this.groupBy(manualRanks, 'phaseId');
    const phaseRegsByPhaseId   = this.groupBy(phaseRegs,   'phaseId');
    const phasesByEcId         = this.groupBy(phases,      'eventCategoryId');
    const regsByEcId           = this.groupBy(registrations, 'eventCategoryId');

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        version: '2.0',
        source: 'competition-system',
      },
      event:  this.buildEventInfo(sismasterEvent),
      sports: this.buildSports(
        filteredCategories,
        regsByEcId,
        regMap,
        phasesByEcId,
        matchesByPhaseId,
        standingsByPhaseId,
        manualRanksByPhaseId,
        phaseRegsByPhaseId,
      ),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILDERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────

  private buildEventInfo(event: EventSismasterDto) {
    return {
      sismasterEventId: event.idevent,
      name:      event.name,
      startDate: event.startdate,
      endDate:   event.enddate,
      place:     event.place    ?? null,
      logo:      event.logo     ?? null,
      modality:  event.modality ?? null,
      tipo:      event.tipo     ?? null,
      level:     event.level    ?? null,
    };
  }

  private buildSports(
    eventCategories: EventCategory[],
    regsByEcId: Record<number, Registration[]>,
    regMap: Record<number, any>,
    phasesByEcId: Record<number, Phase[]>,
    matchesByPhaseId: Record<number, Match[]>,
    standingsByPhaseId: Record<number, Standing[]>,
    manualRanksByPhaseId: Record<number, PhaseManualRank[]>,
    phaseRegsByPhaseId: Record<number, PhaseRegistration[]>,
  ) {
    const sportMap: Record<string, any> = {};

    for (const ec of eventCategories) {
      const sport    = (ec.category as any)?.sport;
      const sportKey = String(sport?.sportId ?? 'sin_deporte');

      if (!sportMap[sportKey]) {
        sportMap[sportKey] = {
          sportId:           sport?.sportId    ?? null,
          sportName:         sport?.name       ?? 'Sin deporte',
          sportCode:         sport?.code       ?? null,
          formatType:        sport?.formatType ?? null,
          totalParticipants: 0,
          participants:      [],
          categories:        [],
        };
      }

      const regsForCategory   = regsByEcId[ec.eventCategoryId]   ?? [];
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
      sportMap[sportKey].totalParticipants = sportMap[sportKey].participants.length;

      sportMap[sportKey].categories.push({
        eventCategoryId:   ec.eventCategoryId,
        categoryId:        ec.categoryId,
        categoryName:      (ec.category as any)?.name     ?? null,
        gender:            (ec.category as any)?.gender   ?? null,
        ageGroup:          (ec.category as any)?.ageGroup ?? null,
        status:            ec.status,
        totalParticipants: regsForCategory.length,
        participants: regsForCategory
          .map((r) => regMap[r.registrationId])
          .filter(Boolean),
        phases: phasesForCategory.map((phase) =>
          this.buildPhase(
            phase,
            matchesByPhaseId,
            standingsByPhaseId,
            manualRanksByPhaseId,
            phaseRegsByPhaseId,
            regMap,
          ),
        ),
      });
    }

    return Object.values(sportMap);
  }

  private buildPhase(
    phase: Phase,
    matchesByPhaseId: Record<number, Match[]>,
    standingsByPhaseId: Record<number, Standing[]>,
    manualRanksByPhaseId: Record<number, PhaseManualRank[]>,
    phaseRegsByPhaseId: Record<number, PhaseRegistration[]>,
    regMap: Record<number, any>,
  ) {
    const phaseMatches     = matchesByPhaseId[phase.phaseId]     ?? [];
    const phaseStandings   = standingsByPhaseId[phase.phaseId]   ?? [];
    const phaseManualRanks = manualRanksByPhaseId[phase.phaseId] ?? [];
    const phaseRegs        = phaseRegsByPhaseId[phase.phaseId]   ?? [];

    // ── Participantes de la fase ──────────────────────────────────────────
    // Fuente 1 (preferida): phase_registrations
    // Fuente 2 (fallback):  participations en matches
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

    // ── Podio: phase_manual_ranks tiene prioridad sobre standings ─────────
    let podium: any[];

    if (phaseManualRanks.length > 0) {
      // Fuente: phase_manual_ranks → Judo, Karate, Taekwondo, bracket puro
      podium = phaseManualRanks.map((mr) => ({
        rank:    mr.manualRankPosition,
        athlete: regMap[mr.registrationId] ?? { registrationId: mr.registrationId },
      }));
    } else {
      // Fuente: standings → Round-robin, grupos, natación, atletismo
      podium = phaseStandings
        .map((s) => ({
          rank:          s.manualRankPosition ?? s.rankPosition ?? null,
          matchesPlayed: s.matchesPlayed,
          wins:          s.wins,
          draws:         s.draws,
          losses:        s.losses,
          points:        Number(s.points),
          scoreFor:      s.scoreFor,
          scoreAgainst:  s.scoreAgainst,
          athlete:       regMap[s.registrationId] ?? { registrationId: s.registrationId },
        }))
        .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
    }

    // ── totalBrackets: contar series únicas + matches sin serie ───────────
    const uniqueBracketCount = this.countUniqueBrackets(phaseMatches);

    return {
      phaseId:           phase.phaseId,
      phaseName:         phase.name         ?? null,
      phaseType:         phase.type         ?? null,
      displayOrder:      phase.displayOrder ?? null,
      totalParticipants: phaseParticipants.length,
      totalBrackets:     uniqueBracketCount,
      participants:      phaseParticipants,
      brackets:          this.buildBrackets(phaseMatches, regMap),
      podium,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BRACKET BUILDERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Decide si un match es parte de una serie (Taekwondo, Tenis, etc.)
   * o es un match individual (Judo, Karate, etc.) y delega al builder correcto.
   */
  private buildBrackets(matches: Match[], regMap: Record<number, any>): any[] {
    const standalone = matches.filter((m) => !m.seriesId);
    const inSeries   = matches.filter((m) =>  m.seriesId);

    // Agrupar por seriesId
    const seriesMap: Record<string, Match[]> = {};
    for (const m of inSeries) {
      if (!seriesMap[m.seriesId]) seriesMap[m.seriesId] = [];
      seriesMap[m.seriesId].push(m);
    }

    const result: any[] = [
      // Matches individuales (Judo, Karate, Poomsae, etc.)
      ...standalone.map((m) => this.buildBracket(m, regMap)),
      // Series agrupadas (Taekwondo por rondas, Tenis por sets, etc.)
      ...Object.entries(seriesMap).map(([seriesId, seriesMatches]) =>
        this.buildSeriesBracket(seriesId, seriesMatches, regMap),
      ),
    ];

    // Reordenar globalmente por matchNumber
    return result.sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));
  }

  /**
   * Match individual — sin serie.
   * Usado por: Judo, Karate, Poomsae, Lucha, Wushu, etc.
   */
  private buildBracket(match: Match, regMap: Record<number, any>) {
    return {
      bracketId:      match.matchId,
      isSeries:       false,
      matchNumber:    match.matchNumber    ?? null,
      round:          match.round          ?? null,
      status:         match.status,
      scheduledTime:  match.scheduledTime  ?? null,
      platformNumber: match.platformNumber ?? null,
      isWalkover:     match.isWalkover,
      walkoverReason: match.walkoverReason ?? null,
      victoryType:    match.victoryType    ?? null,
      participants: (match.participations ?? []).map((p) => ({
        participationId: p.participationId,
        corner:  p.corner ?? null,
        athlete:
          p.registrationId != null
            ? regMap[p.registrationId] ?? { registrationId: p.registrationId }
            : null,
      })),
      scores: {
        participant1: {
          score:        match.participant1Score        != null ? Number(match.participant1Score)        : null,
          accuracy:     match.participant1Accuracy     != null ? Number(match.participant1Accuracy)     : null,
          presentation: match.participant1Presentation != null ? Number(match.participant1Presentation) : null,
        },
        participant2: {
          score:        match.participant2Score        != null ? Number(match.participant2Score)        : null,
          accuracy:     match.participant2Accuracy     != null ? Number(match.participant2Accuracy)     : null,
          presentation: match.participant2Presentation != null ? Number(match.participant2Presentation) : null,
        },
      },
      winner: match.winnerRegistrationId
        ? regMap[match.winnerRegistrationId] ?? { registrationId: match.winnerRegistrationId }
        : null,
    };
  }

  /**
   * Serie agrupada — múltiples matches bajo el mismo seriesId.
   * Usado por: Taekwondo (rondas), Tenis (sets), mejor-de-3, etc.
   */
  private buildSeriesBracket(
    seriesId: string,
    matches: Match[],
    regMap: Record<number, any>,
  ) {
    // Ordenar por número de match dentro de la serie
    const sorted = [...matches].sort(
      (a, b) => (a.seriesMatchNumber ?? 0) - (b.seriesMatchNumber ?? 0),
    );
    const first = sorted[0];

    // Participantes tomados del primer match de la serie
    const participants = (first.participations ?? []).map((p) => ({
      participationId: p.participationId,
      corner:  p.corner ?? null,
      athlete:
        p.registrationId != null
          ? regMap[p.registrationId] ?? { registrationId: p.registrationId }
          : null,
    }));

    // Ganador de la serie completa
    const seriesWinnerId = first.seriesWinnerRegistrationId ?? null;

    // Conteo de rondas/sets ganados por cada participante
    const seriesScore = this.resolveSeriesScore(sorted, first.participations ?? []);

    return {
      bracketId:      null,           // La serie no tiene un ID único propio
      isSeries:       true,
      seriesId,
      matchNumber:    first.matchNumber    ?? null,
      round:          first.round          ?? null,
      status:         this.resolveSeriesStatus(sorted),
      scheduledTime:  first.scheduledTime  ?? null,
      platformNumber: first.platformNumber ?? null,
      participants,

      // Marcador global de la serie (ej: "2-1" en un mejor de 3)
      seriesScore,

      // Cada ronda o set individual
      rounds: sorted.map((m) => ({
        roundNumber:    m.seriesMatchNumber ?? null,
        matchId:        m.matchId,
        status:         m.status,
        isWalkover:     m.isWalkover,
        walkoverReason: m.walkoverReason ?? null,
        victoryType:    m.victoryType    ?? null,
        scores: {
          participant1: {
            score:        m.participant1Score        != null ? Number(m.participant1Score)        : null,
            accuracy:     m.participant1Accuracy     != null ? Number(m.participant1Accuracy)     : null,
            presentation: m.participant1Presentation != null ? Number(m.participant1Presentation) : null,
          },
          participant2: {
            score:        m.participant2Score        != null ? Number(m.participant2Score)        : null,
            accuracy:     m.participant2Accuracy     != null ? Number(m.participant2Accuracy)     : null,
            presentation: m.participant2Presentation != null ? Number(m.participant2Presentation) : null,
          },
        },
        winner: m.winnerRegistrationId
          ? regMap[m.winnerRegistrationId] ?? { registrationId: m.winnerRegistrationId }
          : null,
      })),

      // Ganador de la serie completa
      seriesWinner: seriesWinnerId
        ? regMap[seriesWinnerId] ?? { registrationId: seriesWinnerId }
        : null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SERIES HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resuelve el estado global de una serie basándose en sus matches.
   */
  private resolveSeriesStatus(matches: Match[]): MatchStatus {
    if (matches.every((m) => m.status === MatchStatus.FINALIZADO))
      return MatchStatus.FINALIZADO;
    if (matches.some((m) => m.status === MatchStatus.EN_CURSO))
      return MatchStatus.EN_CURSO;
    return MatchStatus.PROGRAMADO;
  }

  /**
   * Cuenta cuántas rondas/sets ha ganado cada participante en la serie.
   * Retorna { participant1Wins, participant2Wins } usando el orden de
   * participations del primer match como referencia.
   */
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

  /**
   * Cuenta brackets únicos: series cuentan como 1, matches sueltos cuentan individualmente.
   */
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
      const person      = reg.externalAthleteId     ? personMap[reg.externalAthleteId]          : null;
      const institution = reg.externalInstitutionId ? institutionMap[reg.externalInstitutionId] : null;

      let athleteInfo: any = null;

      if (person) {
        athleteInfo = {
          source:    'sismaster',
          personId:  reg.externalAthleteId,
          fullName:  [person.lastname, person.surname, person.firstname].filter(Boolean).join(' '),
          document:  person.docnumber ?? null,
          gender:    person.gender    ?? null,
          birthDate: person.birthday  ?? null,
          institution: {
            id:   reg.externalInstitutionId ?? null,
            name: institution?.businessName ?? institution?.business ?? null,
          },
        };
      } else if (reg.athlete) {
        athleteInfo = {
          source:    'local',
          personId:  null,
          fullName:  [(reg.athlete as any).lastName, (reg.athlete as any).firstName].filter(Boolean).join(', '),
          document:  (reg.athlete as any).docNumber ?? null,
          gender:    (reg.athlete as any).gender    ?? null,
          birthDate: (reg.athlete as any).birthDate ?? null,
          institution: null,
        };
      } else if (reg.team) {
        athleteInfo = {
          source:   'team',
          teamId:   reg.teamId,
          teamName: (reg.team as any).name ?? null,
        };
      }

      map[reg.registrationId] = {
        registrationId:          reg.registrationId,
        seedNumber:              reg.seedNumber              ?? null,
        weightClass:             reg.weightClass             ?? null,
        externalAthleteId:       reg.externalAthleteId       ?? null,
        externalInstitutionId:   reg.externalInstitutionId   ?? null,
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
      meta:  { generatedAt: new Date().toISOString(), version: '2.0', source: 'competition-system' },
      event: this.buildEventInfo(event),
      sports: [],
    };
  }
}
