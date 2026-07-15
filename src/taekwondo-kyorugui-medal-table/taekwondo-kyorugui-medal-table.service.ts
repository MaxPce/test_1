// src/taekwondo-kyorugui-medal-table/taekwondo-kyorugui-medal-table.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  TaekwondoKyoruguiMedalRow,
  TaekwondoKyoruguiMedalSummaryResponse,
} from './dto/medal-summary-response.dto';
import { TaekwondoMedalDetailResponse, TaekwondoMedalDetailRow } from './dto/medal-detail-response.dto';

@Injectable()
export class TaekwondoKyoruguiMedalTableService {
  constructor(private readonly dataSource: DataSource) {}

  async getMedalSummary(
    externalEventId: number,
    localSportId: number,
  ): Promise<TaekwondoKyoruguiMedalSummaryResponse> {
    // ─────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener todos los phase_manual_ranks del evento+deporte,
    // junto con participantCount por fase.
    //
    // El puesto manual (manual_rank_position) es la única fuente de verdad.
    // Funciona igual para fases de eliminación, grupos y mejor de 3,
    // porque en los tres casos el usuario ya resolvió el puesto final
    // al guardar el ranking manual — no se necesita validar victorias
    // en `matches`.
    //
    // Regla única aplicada:
    //   R1 - 1 participante  → solo participación, sin medalla
    //   R2 - ≥2 participantes → posición 1 = oro, 2 = plata, 3 = bronce
    //        (soporta empates: si 2 personas quedan en 3er puesto,
    //         ambas reciben bronce, sin tope artificial)
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
    }> = await this.dataSource.query(
      `
      SELECT
        pmr.phase_id                                          AS phaseId,
        ph.name                                               AS phaseName,
        ph.type                                               AS phaseType,
        pmr.registration_id                                   AS registrationId,
        pmr.manual_rank_position                              AS position,
        COALESCE(inst.institution_id, t_inst.institution_id, 0) AS institutionId,
        COALESCE(inst.name, t_inst.name, 'N/A')               AS institutionName,
        COALESCE(inst.logo_url, t_inst.logo_url, NULL)         AS institutionLogoUrl,
        -- Conteo de inscritos en la fase (se usa solo para la regla R1)
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
        )                                                     AS participantCount
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
    // PASO 2: Acumular medallas por institución (sin validar wins)
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
        });
      }
      return accumulator.get(id)!;
    };

    // Agrupar por fase solo para aplicar la regla R1 (1 participante = sin medalla)
    const rowsByPhase = new Map<number, typeof rows>();
    for (const row of rows) {
      if (!rowsByPhase.has(row.phaseId)) {
        rowsByPhase.set(row.phaseId, []);
      }
      rowsByPhase.get(row.phaseId)!.push(row);
    }

    for (const phaseRows of rowsByPhase.values()) {
      const count = Number(phaseRows[0]?.participantCount ?? 0);

      // R1: 1 participante → sin medalla
      if (count < 2) continue;

      for (const row of phaseRows) {
        const pos  = Number(row.position);
        const inst = ensureInstitution(
          row.institutionId,
          row.institutionName,
          row.institutionLogoUrl,
        );

        // R2: la posición manual manda directamente.
        // Sin exigir victorias, sin tope de bronces —
        // si dos personas comparten el 3er puesto, ambas reciben bronce.
        if (pos === 1) inst.gold   += 1;
        else if (pos === 2) inst.silver += 1;
        else if (pos === 3) inst.bronze += 1;
        // Nota: Taekwondo universitario NO otorga medallas de 5° ni 7°
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 3: Ordenar y asignar rank con soporte de empates
    // ─────────────────────────────────────────────────────────────────────
    const sorted = [...accumulator.values()].sort((a, b) => {
      if (b.gold   !== a.gold)   return b.gold   - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      return b.bronze - a.bronze;
    });

    let currentRank = 1;
    const general: TaekwondoKyoruguiMedalRow[] = sorted.map((row, idx) => {
      if (idx > 0) {
        const prev = sorted[idx - 1];
        const tied =
          row.gold   === prev.gold   &&
          row.silver === prev.silver &&
          row.bronze === prev.bronze;
        if (!tied) currentRank = idx + 1;
      }
      return { rank: currentRank, ...row };
    });

    return { general };
  }
  async getMedalDetailByInstitution(
    externalEventId: number,
    localSportId: number,
    institutionId: number,
  ): Promise<TaekwondoMedalDetailResponse> {
    const rows: Array<{
      phaseId: number;
      phaseName: string;
      registrationId: number;
      position: number;
      categoryName: string;
      athleteName: string;
      institutionId: number;
      institutionName: string;
      participantCount: number;
    }> = await this.dataSource.query(
      `
      SELECT
        pmr.phase_id                                          AS phaseId,
        ph.name                                               AS phaseName,
        pmr.registration_id                                   AS registrationId,
        pmr.manual_rank_position                              AS position,
        cat.name                                               AS categoryName,
        COALESCE(
          a.name,
          tm.name,
          'N/A'
        )                                                     AS athleteName,
        COALESCE(inst.institution_id, t_inst.institution_id, 0) AS institutionId,
        COALESCE(inst.name, t_inst.name, 'N/A')               AS institutionName,
        GREATEST(
          (SELECT COUNT(*) FROM phase_registrations pr2 WHERE pr2.phase_id = pmr.phase_id),
          (
            SELECT COUNT(DISTINCT p2.registration_id)
            FROM participations p2
            INNER JOIN matches m2 ON m2.match_id = p2.match_id
            WHERE m2.phase_id = pmr.phase_id AND m2.deleted_at IS NULL
          )
        )                                                     AS participantCount
      FROM phase_manual_ranks pmr
      INNER JOIN phases ph
        ON ph.phase_id = pmr.phase_id AND ph.deleted_at IS NULL
      INNER JOIN event_categories ec
        ON ec.event_category_id = ph.event_category_id
        AND ec.external_event_id = ?
      INNER JOIN categories cat
        ON cat.category_id = ec.category_id AND cat.deleted_at IS NULL
      INNER JOIN sports s
        ON s.sport_id = cat.sport_id AND s.sport_id = ?
      INNER JOIN registrations reg
        ON reg.registration_id = pmr.registration_id AND reg.deleted_at IS NULL
      LEFT JOIN athletes a
        ON a.athlete_id = reg.athlete_id AND a.deleted_at IS NULL
      LEFT JOIN institutions inst
        ON inst.institution_id = a.institution_id
      LEFT JOIN teams tm
        ON tm.team_id = reg.team_id
      LEFT JOIN institutions t_inst
        ON t_inst.institution_id = tm.institution_id
      WHERE pmr.manual_rank_position IS NOT NULL
        AND COALESCE(inst.institution_id, t_inst.institution_id, 0) = ?
      ORDER BY pmr.manual_rank_position, cat.name
      `,
      [externalEventId, localSportId, institutionId],
    );

    const athletes: TaekwondoMedalDetailRow[] = rows
      .filter((row) => Number(row.participantCount) >= 2)
      .map((row) => {
        const pos = Number(row.position);
        const medalType: TaekwondoMedalDetailRow['medalType'] =
          pos === 1 ? 'gold' : pos === 2 ? 'silver' : 'bronze';
        return {
          registrationId: row.registrationId,
          athleteName: row.athleteName,
          categoryName: row.categoryName,
          phaseName: row.phaseName,
          position: pos,
          medalType,
        };
      })
      .filter((row) => [1, 2, 3].includes(row.position));

    return {
      institutionId,
      institutionName: rows[0]?.institutionName ?? 'N/A',
      athletes,
    };
  }

}