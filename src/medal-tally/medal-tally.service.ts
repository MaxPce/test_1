import { Injectable } from '@nestjs/common';
import { CompetitionPhaseReportService } from '../sismaster/competition-phase-report.service';

export type MedalType = 'gold' | 'silver' | 'bronze';

export interface MedalAthlete {
  sport: string;
  sportId: number;
  category: string;
  eventCategoryId: number;
  medal: MedalType;
  rank: number;
  athleteName?: string;
  document?: string;
  teamName?: string;
  teamId?: number;
  members?: { name: string; rol: string }[];
  snatchRank?: number | null;
  cleanAndJerkRank?: number | null;
}

export interface InstitutionTally {
  institutionId: number;
  institutionName: string;
  abrev: string | null;
  logoUrl: string | null;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  medals: MedalAthlete[];
}

export interface SportMedalDetail {
  sportId: number;
  sportName: string;
  categories: {
    eventCategoryId: number;
    categoryName: string;
    podium: any[];
  }[];
}

@Injectable()
export class MedalTallyService {
  constructor(
    private readonly reportService: CompetitionPhaseReportService,
  ) {}

  async getMedalTally(
    eventId: number,
    source: 'haymaster' | 'sismaster' = 'haymaster',
  ): Promise<any> {
    // ── PASO 1: reporte sin filtros solo para obtener eventCategoryIds ────
    const overview = await this.reportService.getPhaseReport(eventId, { source });

    // Recolectar todos los eventCategoryId del evento
    const categoryRefs: { sportId: number; sportName: string; eventCategoryId: number; categoryName: string }[] = [];

    for (const sport of overview.sports ?? []) {
      for (const cat of sport.categories ?? []) {
        categoryRefs.push({
          sportId: sport.sportId,
          sportName: sport.sportName,
          eventCategoryId: cat.eventCategoryId,
          categoryName: cat.categoryName,
        });
      }
    }

    if (categoryRefs.length === 0) {
      return this.buildEmpty(eventId, overview.event);
    }

    // ── PASO 2: cargar cada categoría en paralelo (fuerza detailLevel='category') ──
    const categoryReports = await Promise.allSettled(
      categoryRefs.map((ref) =>
        this.reportService.getPhaseReport(eventId, {
          source,
          eventCategoryId: ref.eventCategoryId,
        }),
      ),
    );

    // ── PASO 3: procesar podios ───────────────────────────────────────────
    const tallyMap = new Map<number, InstitutionTally>();
    const bySportMap = new Map<number, SportMedalDetail>();
    const MEDAL_MAP: Record<number, MedalType> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

    for (let i = 0; i < categoryRefs.length; i++) {
      const ref = categoryRefs[i];
      const settled = categoryReports[i];
      if (settled.status === 'rejected') continue;

      const catReport = settled.value;

      // Buscar el sport y categoría en el reporte
      for (const sport of catReport.sports ?? []) {
        for (const category of sport.categories ?? []) {
          if (category.eventCategoryId !== ref.eventCategoryId) continue;

          // Inicializar sport en bySportMap
          if (!bySportMap.has(ref.sportId)) {
            bySportMap.set(ref.sportId, {
              sportId: ref.sportId,
              sportName: ref.sportName,
              categories: [],
            });
          }

          const categoryPodium: any[] = [];

          for (const phase of category.phases ?? []) {
            for (const entry of phase.podium ?? []) {
              const rank: number = entry.rank;
              if (!rank || rank > 3) continue;

              const medal = MEDAL_MAP[rank];
              const athleteData = entry.athlete?.athlete;
              if (!athleteData) continue;

              const institution = athleteData.institution;
              if (!institution?.id) continue;

              const instId: number = institution.id;
              const entrySource: string = athleteData.source;
              const isWeightlifting = phase.isWeightlifting === true;

              // ── Tally por institución ─────────────────────────────────
              if (!tallyMap.has(instId)) {
                tallyMap.set(instId, {
                  institutionId: instId,
                  institutionName: institution.name,
                  abrev: institution.abrev ?? null,
                  logoUrl: institution.logoUrl ?? null,
                  gold: 0, silver: 0, bronze: 0, total: 0,
                  medals: [],
                });
              }

              const tally = tallyMap.get(instId)!;
              tally[medal]++;
              tally.total++;

              const medalEntry: MedalAthlete = {
                sport: ref.sportName,
                sportId: ref.sportId,
                category: ref.categoryName,
                eventCategoryId: ref.eventCategoryId,
                medal,
                rank,
              };

              if (entrySource === 'team') {
                medalEntry.teamName = athleteData.teamName;
                medalEntry.teamId = athleteData.teamId;
                medalEntry.members = (athleteData.members ?? []).map((m: any) => ({
                  name: m.name,
                  rol: m.rol,
                }));
              } else {
                medalEntry.athleteName = athleteData.fullName;
                medalEntry.document = athleteData.document;
                if (isWeightlifting) {
                  medalEntry.snatchRank = entry.snatchRank ?? null;
                  medalEntry.cleanAndJerkRank = entry.cleanAndJerkRank ?? null;
                }
              }

              tally.medals.push(medalEntry);

              // ── Detalle por deporte ───────────────────────────────────
              const podiumEntry: any = {
                rank,
                medal,
                institutionId: instId,
                institutionName: institution.name,
                abrev: institution.abrev ?? null,
                source: entrySource,
              };

              if (entrySource === 'team') {
                podiumEntry.teamName = athleteData.teamName;
                podiumEntry.members = medalEntry.members;
              } else {
                podiumEntry.athleteName = athleteData.fullName;
                if (isWeightlifting) {
                  podiumEntry.snatchRank = entry.snatchRank ?? null;
                  podiumEntry.cleanAndJerkRank = entry.cleanAndJerkRank ?? null;
                }
              }

              categoryPodium.push(podiumEntry);
            }
          }

          if (categoryPodium.length > 0) {
            bySportMap.get(ref.sportId)!.categories.push({
              eventCategoryId: ref.eventCategoryId,
              categoryName: ref.categoryName,
              podium: categoryPodium.sort((a, b) => a.rank - b.rank),
            });
          }
        }
      }
    }

    // ── Ordenar medallero olímpico ─────────────────────────────────────────
    const medalTally = Array.from(tallyMap.values()).sort((a, b) => {
      if (b.gold   !== a.gold)   return b.gold   - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      return b.bronze - a.bronze;
    });

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        version: '1.0',
        source: 'medal-tally',
      },
      event: overview.event,          // ← nombre e info del evento incluidos
      eventId,
      summary: {
        totalInstitutions: medalTally.length,
        totalMedals:  medalTally.reduce((s, t) => s + t.total,  0),
        totalGold:    medalTally.reduce((s, t) => s + t.gold,   0),
        totalSilver:  medalTally.reduce((s, t) => s + t.silver, 0),
        totalBronze:  medalTally.reduce((s, t) => s + t.bronze, 0),
      },
      medalTally,
      bySport: Array.from(bySportMap.values()),
    };
  }

  private buildEmpty(eventId: number, event: any) {
    return {
      meta: { generatedAt: new Date().toISOString(), version: '1.0', source: 'medal-tally' },
      event,
      eventId,
      summary: { totalInstitutions: 0, totalMedals: 0, totalGold: 0, totalSilver: 0, totalBronze: 0 },
      medalTally: [],
      bySport: [],
    };
  }
}