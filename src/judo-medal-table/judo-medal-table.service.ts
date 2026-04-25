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
    //   8.2 - 2 participantes → medalla a 1° y 2° (no requiere victoria)
    //   8.3 - 3 participantes → medallas a pos 1, 2, 3 (requiere ≥1 victoria)
    //   8.4 - ≥4 participantes → medallas a pos 1, 2 y DOS pos 3 (requiere ≥1 victoria)
    //   8.5 - Para pos 1/2/3 con ≥3 inscritos: debe haber ganado al menos 1 combate
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
      institutionLogoUrl: string | null;
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
        COALESCE(inst.logo_url, t_inst.logo_url, NULL)       AS institutionLogoUrl,
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
        )                                                   AS winsCount
      FROM phase_manual_ranks pmr
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
      {
        institutionId: number;
        institutionName: string;
        institutionLogoUrl: string | null;
        gold: number;
        silver: number;
        bronze: number;
        fifth: number;
        seventh: number;
      }
    >();

    const ensureInstitution = (id: number, name: string, logoUrl: string | null) => { 
      if (!accumulator.has(id)) {
        accumulator.set(id, {
          institutionId: id,
          institutionName: name,
          institutionLogoUrl: logoUrl, 
          gold: 0,
          silver: 0,
          bronze: 0,
          fifth: 0,
          seventh: 0,
        });
      }
      return accumulator.get(id)!;
    };

    // ── Agrupar por fase para controlar terceros por categoría ──────────
    const rowsByPhase = new Map<number, typeof rows>();
    for (const row of rows) {
      if (!rowsByPhase.has(row.phaseId)) {
        rowsByPhase.set(row.phaseId, []);
      }
      rowsByPhase.get(row.phaseId)!.push(row);
    }

    for (const phaseRows of rowsByPhase.values()) {
      // Usamos el participantCount de la primera fila (es el mismo para toda la fase)
      const count = Number(phaseRows[0]?.participantCount ?? 0);

      // ── Regla 8.1: 1 participante → solo participación, sin medalla ──
      if (count < 2) continue;

      // Ordenar defensivamente por posición ascendente
      phaseRows.sort((a, b) => Number(a.position) - Number(b.position));

      // Regla 8.4: con ≥4 inscritos se permiten DOS terceros; con 3 solo UNO
      const allowedBronzes = count >= 4 ? 2 : 1;
      let countedBronzes = 0;

      for (const row of phaseRows) {
        const pos  = Number(row.position);
        const wins = Number(row.winsCount);
        const inst = ensureInstitution(row.institutionId, row.institutionName, row.institutionLogoUrl);

        // ── Posiciones de medalla (1°, 2°, 3°) ─────────────────────────
        if (pos === 1 || pos === 2 || pos === 3) {

          // ── Regla 8.2: exactamente 2 participantes ───────────────────
          // Ambas posiciones computan si pasaron pesaje.
          // La base NO exige victoria en este caso específico.
          if (count === 2) {
            if (pos === 1) inst.gold   += 1;
            if (pos === 2) inst.silver += 1;
            continue;
          }

          // ── Reglas 8.3 / 8.4 / 8.5: 3 o más participantes ──────────
          // Regla 8.5: debe haber ganado al menos 1 combate (aplica a
          // CUALQUIER tipo de fase: eliminacion, round_robin, etc.)
          if (wins < 1) continue;

          if (pos === 1) {
            inst.gold += 1;
            continue;
          }

          if (pos === 2) {
            inst.silver += 1;
            continue;
          }

          if (pos === 3) {
            // Regla 8.4: respetar el límite de terceros por fase
            if (countedBronzes >= allowedBronzes) continue;
            inst.bronze += 1;
            countedBronzes++;
          }
        }

        // ── Posiciones de colocación (5° y 7°) ──────────────────────────
        if (pos === 5 || pos === 7) {
          // Regla 8.6: requiere ≥5 
          if (count < 5) continue;
          if (pos === 5) inst.fifth   += 1;
          if (pos === 7) inst.seventh += 1;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 3: Ordenar por criterio de desempate:
    //   1° Más oros → 2° Más platas → 3° Más bronces → 4° Más quintos → 5° Más séptimos
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