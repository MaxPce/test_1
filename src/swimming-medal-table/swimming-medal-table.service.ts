// src/swimming-medal-table/swimming-medal-table.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  SwimmingMedalRow,
  SwimmingMedalSummaryResponse,
} from './dto/swimming-medal-summary.dto';

// Regla 3.5.6 – Puntaje pruebas individuales (FEDUP)
const INDIVIDUAL_POINTS: Record<number, number> = {
  1: 9, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

type InstAccum = {
  institutionId: number;
  institutionName: string;
  institutionLogoUrl: string | null;
  gold: number;
  silver: number;
  bronze: number;
  totalPoints: number;
};

export interface SwimmingResultEntry {
  rank: number;          // posición en la prueba (puede ser compartida: *7)
  athleteName: string;   // "Apellido, Nombre"
  age: number | null;
  institutionName: string;
  institutionAbbrev: string | null;
  finalTime: string | null;    // formato "2:07.84" o null si NS/DQ
  points: number;              // puntos obtenidos (puede ser decimal)
  notes: string | null;        // "DQ", "DNS", "DNF", "NS", "MM" (Marca Mínima), etc.
  isTied: boolean;             // true si comparte posición con otro (*7)
  isExcluded: boolean;         // x delante del tiempo → excluido del cómputo por institución
}

export interface SwimmingEventResult {
  eventCategoryId: number;
  eventNumber: number;         // número de prueba (Event 1, Event 2…)
  eventName: string;           // "Girls 200 LC Meter Freestyle"
  categoryName: string;        // "Avanzados" | "Noveles"
  gender: string;              // "Damas" | "Varones" | "Mixto"
  isRelay: boolean;
  minMark: string | null;      // Marca Mínima si aplica (ej. "42.00")
  entries: SwimmingResultEntry[];
}

export interface SwimmingFullResultsResponse {
  events: SwimmingEventResult[];
}

@Injectable()
export class SwimmingMedalTableService {
  constructor(private readonly dataSource: DataSource) {}

  async getMedalSummary(
    externalEventId: number,
    localSportId: number,
  ): Promise<SwimmingMedalSummaryResponse> {
    // ── PASO 1: Resultados finales con rank_position ──────────────────────
    const rows: Array<{
      eventCategoryId: number;
      rankPosition: number;
      isRelay: number;
      institutionId: number;
      institutionName: string;
      institutionLogoUrl: string | null;
    }> = await this.dataSource.query(
      `
      SELECT
        ec.event_category_id                                        AS eventCategoryId,
        r.rank_position                                             AS rankPosition,
        ph.is_relay                                                 AS isRelay,
        COALESCE(inst.institution_id, t_inst.institution_id, 0)    AS institutionId,
        COALESCE(inst.name,           t_inst.name,           'N/A') AS institutionName,
        COALESCE(inst.logo_url,       t_inst.logo_url,       NULL)  AS institutionLogoUrl
      FROM results r
      INNER JOIN phases ph
        ON ph.phase_id = r.phase_id
        AND ph.deleted_at IS NULL
      INNER JOIN event_categories ec
        ON ec.event_category_id = ph.event_category_id
        AND ec.external_event_id = ?
      INNER JOIN categories cat
        ON cat.category_id = ec.category_id
      INNER JOIN sports s
        ON s.sport_id = cat.sport_id
        AND s.sport_id = ?
      INNER JOIN participations p
        ON p.participation_id = r.participation_id
      INNER JOIN registrations reg
        ON reg.registration_id = p.registration_id
        AND reg.deleted_at IS NULL
      LEFT JOIN athletes a
        ON a.athlete_id = reg.athlete_id
        AND a.deleted_at IS NULL
      LEFT JOIN institutions inst
        ON inst.institution_id = a.institution_id
      LEFT JOIN teams tm
        ON tm.team_id = reg.team_id
      LEFT JOIN institutions t_inst
        ON t_inst.institution_id = tm.institution_id
      WHERE r.rank_position IS NOT NULL
        AND (
          r.notes IS NULL
          OR (
            r.notes NOT LIKE '%DQ%'
            AND r.notes NOT LIKE '%DNS%'
            AND r.notes NOT LIKE '%DNF%'
          )
        )
      ORDER BY ec.event_category_id ASC, r.rank_position ASC
      `,
      [externalEventId, localSportId],
    );

    // ── PASO 2: Agrupar por prueba ────────────────────────────────────────
    const byCategory = new Map<number, typeof rows>();
    for (const row of rows) {
      const id = Number(row.eventCategoryId);
      if (!byCategory.has(id)) byCategory.set(id, []);
      byCategory.get(id)!.push(row);
    }

    // ── PASO 3: Acumular medallas + puntaje ───────────────────────────────
    const accumulator = new Map<number, InstAccum>();

    const ensureInst = (
      id: number,
      name: string,
      logoUrl: string | null,
    ): InstAccum => {
      if (!accumulator.has(id)) {
        accumulator.set(id, {
          institutionId: id,
          institutionName: name,
          institutionLogoUrl: logoUrl,
          gold: 0, silver: 0, bronze: 0, totalPoints: 0,
        });
      }
      return accumulator.get(id)!;
    };

    for (const catRows of byCategory.values()) {
      const isRelay = Number(catRows[0]?.isRelay ?? 0) === 1;

      if (isRelay) {
        // ── POSTA (Regla 3.5.3) ─────────────────────────────────────────
        // Solo la posta mejor ubicada por institución → puntaje doble
        const seenInstitutions = new Set<number>();

        for (const row of catRows) {
          const instId = Number(row.institutionId);
          if (seenInstitutions.has(instId)) continue;
          seenInstitutions.add(instId);

          const pos  = Number(row.rankPosition);
          const inst = ensureInst(instId, row.institutionName, row.institutionLogoUrl);

          if (pos === 1)      inst.gold++;
          else if (pos === 2) inst.silver++;
          else if (pos === 3) inst.bronze++;

          const pts = (INDIVIDUAL_POINTS[pos] ?? 0) * 2;
          inst.totalPoints += pts;
        }
      } else {
        // ── INDIVIDUAL ──────────────────────────────────────────────────

        // FIX Bug 1: Medallas top-3 sin restricción por institución
        // Usamos `continue` en lugar de `break` para no cortar en empates
        for (const row of catRows) {
          const pos = Number(row.rankPosition);
          if (pos > 3) continue; // no break — puede haber empates en pos < 3 más adelante
          const inst = ensureInst(
            Number(row.institutionId),
            row.institutionName,
            row.institutionLogoUrl,
          );
          if (pos === 1)      inst.gold++;
          else if (pos === 2) inst.silver++;
          else if (pos === 3) inst.bronze++;
        }

        // FIX Bug 2: Puntaje con reparto en empates de tiempo
        // Agrupar filas por rankPosition para detectar empates exactos
        const byPosition = new Map<number, typeof catRows>();
        for (const row of catRows) {
          const pos = Number(row.rankPosition);
          if (!byPosition.has(pos)) byPosition.set(pos, []);
          byPosition.get(pos)!.push(row);
        }

        // Regla 3.5.2: Máx. 2 mejores ubicaciones por institución
        const pointsCountedByInst = new Map<number, number>();

        // Iterar posiciones en orden ascendente
        const sortedPositions = [...byPosition.keys()].sort((a, b) => a - b);

        for (const pos of sortedPositions) {
          const rowsAtPos = byPosition.get(pos)!;
          const basePts   = INDIVIDUAL_POINTS[pos] ?? 0;
          if (basePts === 0) continue; // pos > 8

          // FIX Bug 2: Si hay N atletas empatados en posiciones pos..pos+N-1,
          // los puntos se reparten: suma(pts de pos a pos+N-1) / N
          const tiedCount = rowsAtPos.length;
          let sharedPts   = basePts;

          if (tiedCount > 1) {
            // Sumar los puntos de las posiciones "consumidas" por el empate
            let sum = 0;
            for (let i = 0; i < tiedCount; i++) {
              sum += INDIVIDUAL_POINTS[pos + i] ?? 0;
            }
            sharedPts = sum / tiedCount; // puede ser decimal (.50)
          }

          for (const row of rowsAtPos) {
            const instId  = Number(row.institutionId);
            const already = pointsCountedByInst.get(instId) ?? 0;
            if (already >= 2) continue;

            const inst = ensureInst(instId, row.institutionName, row.institutionLogoUrl);
            inst.totalPoints += sharedPts;
            pointsCountedByInst.set(instId, already + 1);
          }
        }
      }
    }

    // ── PASO 4: Ordenar (Reglas 3.5.4 y 3.5.5) ───────────────────────────
    const sorted = [...accumulator.values()].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.gold        !== a.gold)        return b.gold        - a.gold;
      if (b.silver      !== a.silver)      return b.silver      - a.silver;
      return b.bronze - a.bronze;
    });

    // ── PASO 5: FIX Bug 3 — rank con soporte correcto de empates ─────────
    // Comparar contra el PRIMERO del grupo empatado, no solo el anterior
    const general: SwimmingMedalRow[] = sorted.map((row, idx, arr) => {
      // Buscar el primer índice con la misma combinación pts+oro+plata+bronce
      const firstEqual = arr.findIndex(
        (r) =>
          r.totalPoints === row.totalPoints &&
          r.gold        === row.gold        &&
          r.silver      === row.silver      &&
          r.bronze      === row.bronze,
      );
      return { rank: firstEqual + 1, ...row };
    });

    return { general };
  }
  async getFullResults(
    externalEventId: number,
    localSportId: number,
    ): Promise<SwimmingFullResultsResponse> {
    // ── Traer todos los resultados con datos completos del atleta ────────
    const rows: Array<{
        eventCategoryId: number;
        eventName: string;
        categoryName: string;
        gender: string;
        isRelay: number;
        minMark: string | null;
        rankPosition: number | null;
        athleteLastName: string | null;
        athleteFirstName: string | null;
        teamName: string | null;         // nombre completo equipo/posta
        age: number | null;
        institutionName: string;
        institutionAbbrev: string | null;
        finalTime: string | null;
        notes: string | null;
        isExcluded: number;              // 0/1 — la "x" antes del tiempo en HY-TEK
    }> = await this.dataSource.query(
        `
        SELECT
        ec.event_category_id                                          AS eventCategoryId,
        CONCAT(
            CASE cat.gender
            WHEN 'F' THEN 'Girls'
            WHEN 'M' THEN 'Boys'
            ELSE 'Mixed'
            END,
            ' ',
            ec.name
        )                                                             AS eventName,
        cat.name                                                      AS categoryName,
        CASE cat.gender
            WHEN 'F' THEN 'Damas'
            WHEN 'M' THEN 'Varones'
            ELSE 'Mixto'
        END                                                           AS gender,
        ph.is_relay                                                   AS isRelay,
        ec.min_mark                                                   AS minMark,
        r.rank_position                                               AS rankPosition,
        a.last_name                                                   AS athleteLastName,
        a.first_name                                                  AS athleteFirstName,
        tm.name                                                       AS teamName,
        TIMESTAMPDIFF(YEAR, a.birth_date, CURDATE())                  AS age,
        COALESCE(inst.name, t_inst.name, 'N/A')                       AS institutionName,
        COALESCE(inst.abbreviation, t_inst.abbreviation, NULL)        AS institutionAbbrev,
        r.final_time                                                  AS finalTime,
        r.notes                                                       AS notes,
        COALESCE(r.is_excluded, 0)                                    AS isExcluded
        FROM results r
        INNER JOIN phases ph
        ON ph.phase_id = r.phase_id
        AND ph.deleted_at IS NULL
        INNER JOIN event_categories ec
        ON ec.event_category_id = ph.event_category_id
        AND ec.external_event_id = ?
        INNER JOIN categories cat
        ON cat.category_id = ec.category_id
        
        INNER JOIN sports s
        ON s.sport_id = cat.sport_id
        AND s.sport_id = ?
        INNER JOIN participations p
        ON p.participation_id = r.participation_id
        INNER JOIN registrations reg
        ON reg.registration_id = p.registration_id
        AND reg.deleted_at IS NULL
        LEFT JOIN athletes a
        ON a.athlete_id = reg.athlete_id
        AND a.deleted_at IS NULL
        LEFT JOIN institutions inst
        ON inst.institution_id = a.institution_id
        LEFT JOIN teams tm
        ON tm.team_id = reg.team_id
        LEFT JOIN institutions t_inst
        ON t_inst.institution_id = tm.institution_id
        ORDER BY ec.event_category_id ASC, r.rank_position IS NULL ASC, r.rank_position ASC
        `,
        [externalEventId, localSportId],
    );

    // ── Agrupar por event_category_id ──────────────────────────────────
    const byCategory = new Map<number, typeof rows>();
    for (const row of rows) {
        const id = Number(row.eventCategoryId);
        if (!byCategory.has(id)) byCategory.set(id, []);
        byCategory.get(id)!.push(row);
    }

    // ── Construir respuesta ─────────────────────────────────────────────
    let eventNumber = 1;
    const events: SwimmingEventResult[] = [];

    for (const [ecId, catRows] of byCategory.entries()) {
        const first    = catRows[0];
        const isRelay  = Number(first.isRelay ?? 0) === 1;

        // Detectar qué posiciones están empatadas (isTied = *N en HY-TEK)
        const posCount = new Map<number, number>();
        for (const r of catRows) {
        if (r.rankPosition == null) continue;
        const pos = Number(r.rankPosition);
        posCount.set(pos, (posCount.get(pos) ?? 0) + 1);
        }

        // Calcular puntos por posición con reparto en empates (igual que getMedalSummary)
        const ptsForPos = (pos: number): number => {
        const count = posCount.get(pos) ?? 1;
        if (count <= 1) return INDIVIDUAL_POINTS[pos] ?? 0;
        let sum = 0;
        for (let i = 0; i < count; i++) sum += INDIVIDUAL_POINTS[pos + i] ?? 0;
        return sum / count;
        };

        const entries: SwimmingResultEntry[] = catRows.map((r) => {
        const pos      = r.rankPosition != null ? Number(r.rankPosition) : null;
        const isDQ     = r.notes?.includes('DQ') ?? false;
        const isDNS    = r.notes?.includes('DNS') ?? false;
        const isDNF    = r.notes?.includes('DNF') ?? false;
        const isNS     = r.notes?.includes('NS') ?? false;
        const disqual  = isDQ || isDNS || isDNF || isNS;

        // Nombre: postas muestran nombre del equipo, individuales "Apellido, Nombre"
        const athleteName = isRelay
            ? (r.teamName ?? r.institutionName)
            : [r.athleteLastName, r.athleteFirstName].filter(Boolean).join(', ');

        const basePts  = pos != null && !disqual ? ptsForPos(pos) : 0;
        const pts      = isRelay ? basePts * 2 : basePts;

        return {
            rank:              pos ?? 0,
            athleteName,
            age:               r.age ?? null,
            institutionName:   r.institutionName,
            institutionAbbrev: r.institutionAbbrev,
            finalTime:         r.finalTime,
            points:            pts,
            notes:             r.notes,
            isTied:            pos != null ? (posCount.get(Number(pos)) ?? 1) > 1 : false,
            isExcluded:        Number(r.isExcluded) === 1,
        };
        });

        events.push({
        eventCategoryId: ecId,
        eventNumber:     eventNumber++,
        eventName:       first.eventName,
        categoryName:    first.categoryName,
        gender:          first.gender,
        isRelay,
        minMark:         first.minMark ?? null,
        entries,
        });
    }

    return { events };
    }
}