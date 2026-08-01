import { Injectable } from '@nestjs/common';
import { CompetitionPhaseReportService } from '../sismaster/competition-phase-report.service';

export type MedalType = 'gold' | 'silver' | 'bronze';
export type WeightliftingDiscipline = 'total' | 'snatch' | 'cleanAndJerk';

export interface MedalAthlete {
  sport: string;
  sportId: number;
  category: string;
  eventCategoryId: number;
  medal: MedalType;
  rank: number;
  // 'total'|'snatch'|'cleanAndJerk' para pesas, 'open' para el resto
  disciplineType: 'total' | 'snatch' | 'cleanAndJerk' | 'open';
  athleteName?: string;
  document?: string;
  teamName?: string;
  teamId?: number;
  members?: { name: string; rol: string }[];
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

@Injectable()
export class MedalTallyService {
  

  constructor(
    private readonly reportService: CompetitionPhaseReportService,
  ) {}

  async getMedalTally(
    eventId: number,
    source: 'haymaster' | 'sismaster' = 'haymaster',
  ): Promise<any> {
    // ── PASO 1: reporte sin filtros para obtener eventCategoryIds ──────────
    const overview = await this.reportService.getPhaseReport(eventId, { source });

    const categoryRefs: {
      sportId: number;
      sportName: string;
      eventCategoryId: number;
      categoryName: string;
    }[] = [];

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

    // ── PASO 3: procesar podios ────────────────────────────────────────────
    const tallyMap = new Map<string, InstitutionTally>();
    const MEDAL_MAP: Record<number, MedalType> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

    for (let i = 0; i < categoryRefs.length; i++) {
      const ref = categoryRefs[i];
      const settled = categoryReports[i];
      if (settled.status === 'rejected') continue;

      const catReport = settled.value;

      for (const sport of catReport.sports ?? []) {
        for (const category of sport.categories ?? []) {
          if (category.eventCategoryId !== ref.eventCategoryId) continue;

          for (const phase of category.phases ?? []) {
            const isWeightlifting = phase.isWeightlifting === true;

            if (isWeightlifting) {
                // ── Nueva estructura: podium = { snatch, cleanAndJerk, total } ──────
                const podiumObj = phase.podium as {
                snatch?:       { positions?: any[] };
                cleanAndJerk?: { positions?: any[] };
                total?:        { positions?: any[] };
                } | null;

                if (!podiumObj) continue;

                const wlSections: { key: WeightliftingDiscipline; positions: any[] }[] = [
                { key: 'snatch',       positions: podiumObj.snatch?.positions       ?? [] },
                { key: 'cleanAndJerk', positions: podiumObj.cleanAndJerk?.positions ?? [] },
                { key: 'total',        positions: podiumObj.total?.positions        ?? [] },
                ];

                for (const { key, positions } of wlSections) {
                for (const entry of positions) {
                    const rank: number = entry.rank;
                    if (!rank || rank > 3) continue;

                    const athleteData = entry.athlete?.athlete;
                    if (!athleteData) continue;
                    const institution = athleteData.institution;
                    if (!institution?.id) continue;

                    const medal = MEDAL_MAP[rank];
                    this.addMedal(tallyMap, institution, medal, rank, {
                    sport: ref.sportName,
                    sportId: ref.sportId,
                    category: ref.categoryName,
                    eventCategoryId: ref.eventCategoryId,
                    disciplineType: key,
                    athleteName: athleteData.fullName,
                    document: athleteData.document,
                    });
                }
                }

            } else {
              // ── Individual / Equipo: podium sigue siendo array ───────────────────
              const isSwimming =
                ref.sportName?.toLowerCase().includes('nataci') ||
                ref.sportName?.toLowerCase().includes('swimming');

              // Para natación en equipo: control de una sola medalla por institución/categoría
              const awardedInCategory = new Set<string>();

              // Traer hasta rank 8 para poder redistribuir si hay duplicados
              const rawEntries = ((phase.podium as any[]) ?? [])
                .filter((e) => e.rank != null && e.rank <= 8)
                .sort((a, b) => a.rank - b.rank);

              for (const entry of rawEntries) {
              const athleteData = entry.athlete?.athlete;
              if (!athleteData) continue;
              const institution = athleteData.institution;
              if (!institution?.id) continue;

              const entrySource: string = athleteData.source;
              const isTeamEntry = entrySource === 'team';

              // Clave de deduplicación: institución + categoría
              const groupKey =
                institution.abrev?.trim().toUpperCase() ??
                institution.name.trim().toUpperCase();
              const dedupKey = `${groupKey}:${ref.eventCategoryId}`;

              // Aplicar restricción SOLO en natación + prueba de equipo/relay
              if (isSwimming && isTeamEntry) {
                if (awardedInCategory.has(dedupKey)) continue; // saltar: ya fue premiada
                awardedInCategory.add(dedupKey);
              }

              // ✅ Usar el rank real del entry, no un contador
              const rank: number = entry.rank;
              if (!rank || rank > 3) continue;

              const medal = MEDAL_MAP[rank];
              if (!medal) continue;

              const base = {
                sport: ref.sportName,
                sportId: ref.sportId,
                category: ref.categoryName,
                eventCategoryId: ref.eventCategoryId,
                disciplineType: 'open' as const,
              };

              if (isTeamEntry) {
                this.addMedal(tallyMap, institution, medal, rank, {
                  ...base,
                  teamName: athleteData.teamName,
                  teamId: athleteData.teamId,
                  members: (athleteData.members ?? []).map((m: any) => ({
                    name: m.name,
                    rol: m.rol,
                  })),
                });
              } else {
                this.addMedal(tallyMap, institution, medal, rank, {
                  ...base,
                  athleteName: athleteData.fullName,
                  document: athleteData.document,
                });
              }
            }
          }
        }
        }
      }
    }

    // ── Ordenar: oro > plata > bronce (estándar olímpico) ─────────────────
    const medalTally = Array.from(tallyMap.values()).sort((a, b) => {
      if (b.gold   !== a.gold)   return b.gold   - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      return b.bronze - a.bronze;
    });

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        version: '1.1',
        source: 'medal-tally',
      },
      event: overview.event,
      eventId,
      summary: {
        totalInstitutions: medalTally.length,
        totalMedals:  medalTally.reduce((s, t) => s + t.total,  0),
        totalGold:    medalTally.reduce((s, t) => s + t.gold,   0),
        totalSilver:  medalTally.reduce((s, t) => s + t.silver, 0),
        totalBronze:  medalTally.reduce((s, t) => s + t.bronze, 0),
      },
      medalTally,
    };
  }

  // ── Helper: inicializa la institución si no existe y agrega la medalla ───
  private addMedal(
    tallyMap: Map<string, InstitutionTally>,  // ← string, no number
    institution: { id: number; name: string; abrev?: string | null; logoUrl?: string | null },
    medal: MedalType,
    rank: number,
    data: Omit<MedalAthlete, 'medal' | 'rank'>,
  ) {
    // Agrupa por abrev en mayúsculas; si no tiene, usa el nombre normalizado
    const groupKey = institution.abrev?.trim().toUpperCase()
      ?? institution.name.trim().toUpperCase();

    if (!tallyMap.has(groupKey)) {
      tallyMap.set(groupKey, {
        institutionId: institution.id,
        institutionName: institution.name,
        abrev: institution.abrev ?? null,
        logoUrl: institution.logoUrl ?? null,
        gold: 0, silver: 0, bronze: 0, total: 0,
        medals: [],
      });
    }

    const tally = tallyMap.get(groupKey)!;
    if (!tally.logoUrl && institution.logoUrl) tally.logoUrl = institution.logoUrl;
    tally[medal]++;
    tally.total++;
    tally.medals.push({ ...data, medal, rank });
  }

  private buildEmpty(eventId: number, event: any) {
    return {
      meta: { generatedAt: new Date().toISOString(), version: '1.1', source: 'medal-tally' },
      event,
      eventId,
      summary: { totalInstitutions: 0, totalMedals: 0, totalGold: 0, totalSilver: 0, totalBronze: 0 },
      medalTally: [],
    };
  }
}