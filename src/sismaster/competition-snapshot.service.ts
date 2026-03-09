import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventCategory } from '../events/entities/event-category.entity';
import { Registration } from '../events/entities/registration.entity';
import { Phase } from '../competitions/entities/phase.entity';
import { Match } from '../competitions/entities/match.entity';
import { Participation } from '../competitions/entities/participation.entity';
import { Standing } from '../competitions/entities/standing.entity';
import { SismasterService } from './sismaster.service';
import { EventSismasterDto } from './dto/event-sismaster.dto';

interface SnapshotFilters {
  sportId?: number;
  eventCategoryId?: number;
  phaseId?: number;
}

@Injectable()
export class CompetitionSnapshotService {
  constructor(

    @InjectRepository(EventCategory)
    private readonly eventCategoryRepo: Repository<EventCategory>,

    @InjectRepository(Registration)
    private readonly registrationRepo: Repository<Registration>,

    @InjectRepository(Phase)
    private readonly phaseRepo: Repository<Phase>,

    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,

    @InjectRepository(Participation)
    private readonly participationRepo: Repository<Participation>,

    @InjectRepository(Standing)
    private readonly standingRepo: Repository<Standing>,

    private readonly sismasterService: SismasterService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC
  // ───────────────────────────────────────────────────────────────────────────

  async getCompetitionSnapshot(sismasterEventId: number, filters: SnapshotFilters = {}) {

    // 1. Info del evento desde Sismaster (BD externa)
    const sismasterEvent = await this.sismasterService.getEventById(sismasterEventId);
    if (!sismasterEvent) {
      throw new NotFoundException(`Evento Sismaster #${sismasterEventId} no encontrado`);
    }

    // 2. Categorías locales vinculadas a este evento de Sismaster
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
      return this.buildEmptySnapshot(sismasterEvent);
    }

    // 3. Registraciones
    const registrations = await this.registrationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.athlete', 'athlete')
      .leftJoinAndSelect('r.team', 'team')
      .where('r.event_category_id IN (:...ids)', { ids: eventCategoryIds })
      .andWhere('r.deleted_at IS NULL')
      .getMany();

    // 4. Enriquecer con Sismaster en paralelo
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

    const phases = await phaseQuery.getMany();
    const phaseIds = phases.map((p) => p.phaseId);

    // 6. Matches + Participaciones
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

    // 7. Standings
    const standings = phaseIds.length
      ? await this.standingRepo
          .createQueryBuilder('s')
          .where('s.phase_id IN (:...phaseIds)', { phaseIds })
          .orderBy('s.rank_position', 'ASC')
          .getMany()
      : [];

    // ── Lookup maps ──────────────────────────────────────────────────────────
    const regMap = this.buildRegistrationMap(registrations, personMap, institutionMap);
    const matchesByPhaseId  = this.groupBy(matches,       'phaseId');
    const standingsByPhaseId = this.groupBy(standings,    'phaseId');
    const phasesByEcId       = this.groupBy(phases,       'eventCategoryId');
    const regsByEcId         = this.groupBy(registrations,'eventCategoryId');

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        version: '1.0',
        source: 'competition-system',
      },
      event: {
        sismasterEventId: sismasterEvent.idevent,
        name:             sismasterEvent.name,
        startDate:        sismasterEvent.startdate,
        endDate:          sismasterEvent.enddate,
        place:            sismasterEvent.place    ?? null,
        logo:             sismasterEvent.logo     ?? null,
        modality:         sismasterEvent.modality ?? null,
        tipo:             sismasterEvent.tipo     ?? null,
        level:            sismasterEvent.level    ?? null,
      },
      summary: {
        totalSports: new Set(
          eventCategories
            .map((ec) => (ec.category as any)?.sport?.sportId)
            .filter(Boolean),
        ).size,
        totalCategories:    eventCategories.length,
        totalRegistrations: registrations.length,
        totalPhases:        phases.length,
        totalMatches:       matches.length,
      },
      sports: this.buildSportsTree(
        filteredCategories,
        regsByEcId,
        regMap,
        phasesByEcId,
        matchesByPhaseId,
        standingsByPhaseId,
      ),
    };
  }



  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  private buildRegistrationMap(
    registrations: Registration[],
    personMap: Record<number, any>,
    institutionMap: Record<number, any> = {},
  ): Record<number, any> {
    const map: Record<number, any> = {};

    for (const reg of registrations) {
      const person = reg.externalAthleteId ? personMap[reg.externalAthleteId] : null;
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
          fullName: [(reg.athlete as any).lastName, (reg.athlete as any).firstName]
            .filter(Boolean)
            .join(', '),
          document: (reg.athlete as any).docNumber ?? null,
          gender: (reg.athlete as any).gender ?? null,
          birthDate: (reg.athlete as any).birthDate ?? null,
          institution: null,
        };
      } else if (reg.team) {
        athleteInfo = {
          source: 'team',
          teamId: reg.teamId,
          teamName: (reg.team as any).name ?? null,
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

  private buildSportsTree(
    eventCategories: EventCategory[],
    regsByEcId: Record<number, Registration[]>,
    regMap: Record<number, any>,
    phasesByEcId: Record<number, Phase[]>,
    matchesByPhaseId: Record<number, Match[]>,
    standingsByPhaseId: Record<number, Standing[]>,
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
          categories: [],
        };
      }

      const regs = regsByEcId[ec.eventCategoryId] ?? [];
      const phases = phasesByEcId[ec.eventCategoryId] ?? [];

      sportMap[sportKey].categories.push({
        eventCategoryId: ec.eventCategoryId,
        categoryId: ec.categoryId,
        categoryName: (ec.category as any)?.name ?? null,
        gender: (ec.category as any)?.gender ?? null,
        ageGroup: (ec.category as any)?.ageGroup ?? null,
        status: ec.status,
        externalEventId: ec.externalEventId,
        externalSportParamId: ec.externalSportParamId,
        totalRegistrations: regs.length,
        registrations: regs.map((r) => regMap[r.registrationId]).filter(Boolean),
        phases: phases.map((phase) => {
          const phaseMatches = matchesByPhaseId[phase.phaseId] ?? [];
          const phaseStandings = standingsByPhaseId[phase.phaseId] ?? [];
          return {
            phaseId: phase.phaseId,
            name: phase.name ?? null,
            type: phase.type ?? null,
            displayOrder: phase.displayOrder ?? null,
            totalMatches: phaseMatches.length,
            matches: phaseMatches.map((m) => this.buildMatchSnapshot(m, regMap)),
            standings: phaseStandings
              .sort((a, b) => {
                const ra = a.manualRankPosition ?? a.rankPosition ?? 9999;
                const rb = b.manualRankPosition ?? b.rankPosition ?? 9999;
                return ra - rb;
              })
              .map((s) => ({
                rank: s.manualRankPosition ?? s.rankPosition ?? null,
                matchesPlayed: s.matchesPlayed,
                wins: s.wins,
                draws: s.draws,
                losses: s.losses,
                points: Number(s.points),
                scoreFor: s.scoreFor,
                scoreAgainst: s.scoreAgainst,
                scoreDiff: s.scoreDiff,
                registration: regMap[s.registrationId] ?? { registrationId: s.registrationId },
              })),
          };
        }),
      });
    }

    return Object.values(sportMap);
  }

  private buildMatchSnapshot(match: Match, regMap: Record<number, any>) {
    return {
      matchId: match.matchId,
      matchNumber: match.matchNumber ?? null,
      round: match.round ?? null,
      status: match.status,
      scheduledTime: match.scheduledTime ?? null,
      platformNumber: match.platformNumber ?? null,
      isWalkover: match.isWalkover,
      walkoverReason: match.walkoverReason ?? null,
      victoryType: match.victoryType ?? null,
      seriesId: match.seriesId ?? null,
      seriesMatchNumber: match.seriesMatchNumber ?? null,
      winner: match.winnerRegistrationId
        ? regMap[match.winnerRegistrationId] ?? { registrationId: match.winnerRegistrationId }
        : null,
      seriesWinner: match.seriesWinnerRegistrationId
        ? regMap[match.seriesWinnerRegistrationId] ?? { registrationId: match.seriesWinnerRegistrationId }
        : null,
      scores: {
        participant1: {
          score: match.participant1Score != null ? Number(match.participant1Score) : null,
          accuracy: match.participant1Accuracy != null ? Number(match.participant1Accuracy) : null,
          presentation: match.participant1Presentation != null ? Number(match.participant1Presentation) : null,
        },
        participant2: {
          score: match.participant2Score != null ? Number(match.participant2Score) : null,
          accuracy: match.participant2Accuracy != null ? Number(match.participant2Accuracy) : null,
          presentation: match.participant2Presentation != null ? Number(match.participant2Presentation) : null,
        },
      },
      // participations = esquinas (rojo/azul), corner viene del enum Corner
      participants: (match.participations ?? []).map((p) => ({
        participationId: p.participationId,
        corner: p.corner ?? null,
        registration:
            p.registrationId != null
            ? regMap[p.registrationId] ?? { registrationId: p.registrationId }
            : null,
        })),
    };
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

  private buildEmptySnapshot(sismasterEvent: EventSismasterDto) {
    return {
        meta: { generatedAt: new Date().toISOString(), version: '1.0', source: 'competition-system' },
        event: {
        sismasterEventId: sismasterEvent.idevent,
        name: sismasterEvent.name,
        startDate: sismasterEvent.startdate,
        endDate: sismasterEvent.enddate,
        place: sismasterEvent.place ?? null,
        logo: sismasterEvent.logo ?? null,
        modality: sismasterEvent.modality ?? null,
        tipo: sismasterEvent.tipo ?? null,
        level: sismasterEvent.level ?? null,
        },
        summary: { totalSports: 0, totalCategories: 0, totalRegistrations: 0, totalPhases: 0, totalMatches: 0},
        sports: [],
    };
    }



}
