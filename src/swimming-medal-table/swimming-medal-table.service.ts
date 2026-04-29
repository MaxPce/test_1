// src/swimming-medal-table/swimming-medal-table.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  SwimmingMedalRow,
  SwimmingMedalSummaryResponse,
} from './dto/swimming-medal-summary.dto';

// Regla 3.5.6 – Puntaje pruebas individuales
const INDIVIDUAL_POINTS: Record<number, number> = {
  1: 9, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

@Injectable()
export class SwimmingMedalTableService {
  constructor(private readonly dataSource: DataSource) {}

  async getMedalSummary(
    externalEventId: number,
    localSportId: number,
    ): Promise<SwimmingMedalSummaryResponse> {
    // ─────────────────────────────────────────────────────────────────────
    // PASO 1: Traer todos los resultados finales (con rank_position)
    //   del evento + deporte natación, incluyendo si es posta o individual.
    // ─────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────
    // PASO 2: Agrupar por prueba (event_category_id)
    // ─────────────────────────────────────────────────────────────────────
    const byCategory = new Map<number, typeof rows>();
    for (const row of rows) {
        const id = Number(row.eventCategoryId);
        if (!byCategory.has(id)) byCategory.set(id, []);
        byCategory.get(id)!.push(row);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 3: Acumular medallas + puntaje por institución
    // ─────────────────────────────────────────────────────────────────────
    const accumulator = new Map<
        number,
        {
        institutionId: number;
        institutionName: string;
        institutionLogoUrl: string | null;
        gold: number;
        silver: number;
        bronze: number;
        totalPoints: number;
        }
    >();

    const ensureInstitution = (
        id: number,
        name: string,
        logoUrl: string | null,
    ) => {
        if (!accumulator.has(id)) {
        accumulator.set(id, {
            institutionId: id,
            institutionName: name,
            institutionLogoUrl: logoUrl,
            gold: 0,
            silver: 0,
            bronze: 0,
            totalPoints: 0,
        });
        }
        return accumulator.get(id)!;
    };

    for (const catRows of byCategory.values()) {
        const isRelay = Number(catRows[0]?.isRelay ?? 0) === 1;

        if (isRelay) {
        // ── POSTA (Regla 3.5.3) ──────────────────────────────────────────
        // Solo la posta mejor ubicada de cada institución obtiene
        // medalla + puntaje (doble). SQL ya ordena ASC, la primera
        // aparición de cada institución es siempre su mejor posición.
        const seenInstitutions = new Set<number>();

        for (const row of catRows) {
            const instId = Number(row.institutionId);
            if (seenInstitutions.has(instId)) continue;
            seenInstitutions.add(instId);

            const pos  = Number(row.rankPosition);
            const inst = ensureInstitution(instId, row.institutionName, row.institutionLogoUrl);

            if (pos === 1) inst.gold++;
            else if (pos === 2) inst.silver++;
            else if (pos === 3) inst.bronze++;

            // Puntaje doble (Regla 3.5.7)
            const pts = (INDIVIDUAL_POINTS[pos] ?? 0) * 2;
            inst.totalPoints += pts;
        }
        } else {
        // ── INDIVIDUAL ───────────────────────────────────────────────────

        // Regla 3.5.1: Medallas → top 3 sin restricción por institución
        for (const row of catRows) {
            const pos = Number(row.rankPosition);
            if (pos > 3) break; // ordenado ASC, cortamos aquí
            const inst = ensureInstitution(
            Number(row.institutionId),
            row.institutionName,
            row.institutionLogoUrl,
            );
            if (pos === 1) inst.gold++;
            else if (pos === 2) inst.silver++;
            else if (pos === 3) inst.bronze++;
        }

        // Regla 3.5.2: Puntaje → máx. 2 mejores ubicaciones por institución por prueba
        const pointsCountedByInst = new Map<number, number>();

        for (const row of catRows) {
            const instId  = Number(row.institutionId);
            const pos     = Number(row.rankPosition);
            const already = pointsCountedByInst.get(instId) ?? 0;

            if (already >= 2) continue;

            const pts = INDIVIDUAL_POINTS[pos] ?? 0;
            if (pts === 0) continue; // posición > 8, sin puntos

            const inst = ensureInstitution(instId, row.institutionName, row.institutionLogoUrl);
            inst.totalPoints += pts;
            pointsCountedByInst.set(instId, already + 1);
        }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 4: Ordenar
    // Regla 3.5.4: Clasificación = suma de puntaje (Noveles + Avanzados)
    // Regla 3.5.5: Desempate → Oros → Platas → Bronces
    // ─────────────────────────────────────────────────────────────────────
    const sorted = [...accumulator.values()].sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.gold        !== a.gold)        return b.gold        - a.gold;
        if (b.silver      !== a.silver)      return b.silver      - a.silver;
        return b.bronze - a.bronze;
    });

    // ─────────────────────────────────────────────────────────────────────
    // PASO 5: Asignar rank con soporte de empates
    // ─────────────────────────────────────────────────────────────────────
    let currentRank = 1;
    const general: SwimmingMedalRow[] = sorted.map((row, idx) => {
        if (idx > 0) {
        const prev = sorted[idx - 1];
        const tied =
            row.totalPoints === prev.totalPoints &&
            row.gold        === prev.gold        &&
            row.silver      === prev.silver      &&
            row.bronze      === prev.bronze;
        if (!tied) currentRank = idx + 1;
        }
        return { rank: currentRank, ...row };
    });

    return { general };
    }
}