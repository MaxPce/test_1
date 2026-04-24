// src/judo-medal-table/judo-medal-table.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JudoMedalRow, JudoMedalSummaryResponse } from './dto/medal-summary-response.dto';

@Injectable()
export class JudoMedalTableService {
  constructor(private readonly dataSource: DataSource) {}

  async getMedalSummary(
    externalEventId: number,
    localSportId: number,
  ): Promise<JudoMedalSummaryResponse> {
    // ─────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener todos los phase_manual_ranks del evento+deporte,
    // junto con el conteo de inscritos por fase y si ganó algún combate.
    //
    // Reglas aplicadas:
    //   8.1 - 1 participante → solo participación, sin medalla
    //   8.2 - 2 participantes → medalla si no walkover (is_walkover=0 al menos en 1 match)
    //   8.3 - 3 participantes → medallas a pos 1, 2, 3
    //   8.4 - ≥4 participantes → medallas a pos 1, 2 y DOS pos 3
    //   8.5 - Para pos 1/2/3: debe haber ganado al menos 1 combate
    //   8.6 - Para pos 5/7: ≥5 inscritos y haber ganado al menos 1 combate
    // ─────────────────────────────────────────────────────────────────────
    const rows: Array<{
      phaseId: number;
      phaseName: string;
      phaseType: string;
      registrationId: number;
      position: number;
      institutionId: number;
      institutionName: string;
      participantCount: number;
      winsCount: number;
    }> = await this.dataSource.query(
      `
      SELECT
        pmr.phase_id                                        AS phaseId,
        ph.name                                             AS phaseName,
        ph.type                                             AS phaseType,
        pmr.registration_id                                 AS registrationId,
        pmr.manual_rank_position                            AS position,
        COALESCE(inst.institution_id, t_inst.institution_id, 0) AS institutionId,
        COALESCE(inst.name, t_inst.name, 'N/A')             AS institutionName,
        -- Conteo de inscritos en esta fase (reglas 8.1–8.4 y 8.6)
        GREATEST(
          (
            SELECT COUNT(*)
            FROM phase_registrations pr2
            WHERE pr2.phase_id = pmr.phase_id
          ),
          (
            SELECT COUNT(DISTINCT p2.registration_id)
            FROM participations p2
            INNER JOIN matches m2 ON m2.match_id = p2.match_id
            WHERE m2.phase_id = pmr.phase_id
              AND m2.deleted_at IS NULL
          )
        )                                                   AS participantCount,
        -- Cuántos combates ganó este registration en esta fase (reglas 8.5 y 8.6)
        (
        SELECT COUNT(*)
        FROM matches m
        WHERE m.phase_id = pmr.phase_id
            AND m.winner_registration_id = pmr.registration_id
            AND m.is_walkover = 0
            AND m.deleted_at IS NULL
        )  AS winsCount
      FROM phase_manual_ranks pmr
      -- Navegar hasta sport para filtrar por localSportId
      INNER JOIN phases ph
        ON ph.phase_id = pmr.phase_id
        AND ph.deleted_at IS NULL
      INNER JOIN event_categories ec
        ON ec.event_category_id = ph.event_category_id
        AND ec.external_event_id = ?
      INNER JOIN categories cat
        ON cat.category_id = ec.category_id
        AND cat.deleted_at IS NULL
      INNER JOIN sports s
        ON s.sport_id = cat.sport_id
        AND s.sport_id = ?
      -- Navegar hasta institución
      INNER JOIN registrations reg
        ON reg.registration_id = pmr.registration_id
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
      WHERE pmr.manual_rank_position IS NOT NULL
      ORDER BY pmr.phase_id, pmr.manual_rank_position
      `,
      [externalEventId, localSportId],
    );

    // ─────────────────────────────────────────────────────────────────────
    // PASO 2: Aplicar reglas de cómputo y acumular medallas por institución
    // ─────────────────────────────────────────────────────────────────────
    const accumulator = new Map<
      number,
      { institutionId: number; institutionName: string; gold: number; silver: number; bronze: number; fifth: number; seventh: number }
    >();

    const ensureInstitution = (id: number, name: string) => {
      if (!accumulator.has(id)) {
        accumulator.set(id, {
          institutionId: id,
          institutionName: name,
          gold: 0, silver: 0, bronze: 0, fifth: 0, seventh: 0,
        });
      }
      return accumulator.get(id)!;
    };

    for (const row of rows) {
      const { institutionId, institutionName, position, participantCount, winsCount, phaseType } = row;
      const count = Number(participantCount);
      const wins  = Number(winsCount);
      const pos   = Number(position);
      const inst  = ensureInstitution(institutionId, institutionName);

      // ── Regla 8.1: 1 participante → solo participación, sin medalla ──
      if (count < 2) continue;

      // ── Posiciones de medalla (1°, 2°, 3°) ───────────────────────────
      if (pos === 1 || pos === 2 || pos === 3) {
        // Regla 8.5: debe haber ganado al menos 1 combate
        if (phaseType === 'eliminacion' && wins < 1) continue;

        // Regla 8.2: 2 participantes → 1° y 2° reciben medalla
        // Regla 8.3: 3 participantes → 1°, 2° y 3° reciben medalla
        // Regla 8.4: ≥4 participantes → 1°, 2° y DOS 3° reciben medalla
        // → Todas cubiertas: si pos ≤ 3 y hay ≥2 inscritos y ganó ≥1 combate, computa
        if (pos === 1) inst.gold   += 1;
        if (pos === 2) inst.silver += 1;
        if (pos === 3) inst.bronze += 1;
      }

      // ── Posiciones de colocación (5° y 7°) ───────────────────────────
      if (pos === 5 || pos === 7) {
        // Regla 8.6: requiere ≥5 inscritos y al menos 1 combate ganado
        if (count < 5 || wins < 1) continue;
        if (pos === 5) inst.fifth   += 1;
        if (pos === 7) inst.seventh += 1;
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 3: Ordenar por criterio de desempate (igual que la imagen):
    //   1° Más oros → 2° Más platas → 3° Más bronces → 4° Más quintos
    // Asignar rank con soporte de empates
    // ─────────────────────────────────────────────────────────────────────
    const sorted = [...accumulator.values()].sort((a, b) => {
      if (b.gold    !== a.gold)    return b.gold    - a.gold;
      if (b.silver  !== a.silver)  return b.silver  - a.silver;
      if (b.bronze  !== a.bronze)  return b.bronze  - a.bronze;
      if (b.fifth   !== a.fifth)   return b.fifth   - a.fifth;
      return b.seventh - a.seventh;
    });

    let currentRank = 1;
    const general: JudoMedalRow[] = sorted.map((row, idx) => {
      if (idx > 0) {
        const prev = sorted[idx - 1];
        const tied =
          row.gold    === prev.gold    &&
          row.silver  === prev.silver  &&
          row.bronze  === prev.bronze  &&
          row.fifth   === prev.fifth   &&
          row.seventh === prev.seventh;
        if (!tied) currentRank = idx + 1;
      }
      return { rank: currentRank, ...row };
    });

    return { general };
  }
}