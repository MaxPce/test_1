// src/weightlifting-medal-table/weightlifting-medal-table.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  WeightliftingMedalRow,
  WeightliftingMedalSummaryResponse,
} from './dto/medal-summary-response.dto';
import { WeightliftingMedalDetailResponse, WeightliftingMedalDetailRow } from './dto/medal-detail-response.dto';

interface AthleteResult {
  registrationId: number;
  weightClass: string | null;
  phaseId: number;
  institutionId: number;
  institutionName: string;
  institutionLogoUrl: string | null;
  bestSnatch: number | null;
  bestCleanAndJerk: number | null;
  total: number | null;
  // Para desempate IWF: quién alcanzó el total con el menor número de intento global
  totalAchievedAtAttempt: number | null;
}

@Injectable()
export class WeightliftingMedalTableService {
  constructor(private readonly dataSource: DataSource) {}

  async getMedalSummary(
    externalEventId: number,
    localSportId: number,
  ): Promise<WeightliftingMedalSummaryResponse> {
    // ─────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener todos los intentos válidos del evento+deporte,
    // junto con weightClass e institución del atleta.
    //
    // Reglas IWF aplicadas:
    //   W1 - El total = bestSnatch + bestCleanAndJerk
    //   W2 - Sin total (falló todos los arranques o todos los enviones) →
    //        no recibe medalla (queda fuera del ranking)
    //   W3 - Desempate en total: gana quien alcanzó ese total en el menor
    //        número de intento acumulado (snatch 1-3, cnj 4-6)
    //   W4 - Cada weight_class dentro de una phase es una categoría
    //        independiente → 1 oro, 1 plata, 1 bronce por clase
    // ─────────────────────────────────────────────────────────────────────
    const rawRows: Array<{
      registrationId: number;
      phaseId: number;
      weightClass: string | null;
      institutionId: number;
      institutionName: string;
      institutionLogoUrl: string | null;
      liftType: 'snatch' | 'clean_and_jerk';
      weightKg: number | null;
      result: string;
      attemptNumber: number;
    }> = await this.dataSource.query(
      `
      SELECT
        reg.registration_id                                       AS registrationId,
        m.phase_id                                                AS phaseId,
        reg.weight_class                                          AS weightClass,
        COALESCE(inst.institution_id, t_inst.institution_id, 0)   AS institutionId,
        COALESCE(inst.name, t_inst.name, 'N/A')                   AS institutionName,
        COALESCE(inst.logo_url, t_inst.logo_url, NULL)            AS institutionLogoUrl,
        wa.lift_type                                              AS liftType,
        wa.weight_kg                                              AS weightKg,
        wa.result                                                 AS result,
        wa.attempt_number                                         AS attemptNumber
      FROM weightlifting_attempts wa
      INNER JOIN participations p
        ON p.participation_id = wa.participation_id
      INNER JOIN matches m
        ON m.match_id = p.match_id
        AND m.deleted_at IS NULL
      INNER JOIN phases ph
        ON ph.phase_id = m.phase_id
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
      ORDER BY reg.registration_id, wa.lift_type, wa.attempt_number
      `,
      [externalEventId, localSportId],
    );

    if (rawRows.length === 0) return { general: [] };

    // ─────────────────────────────────────────────────────────────────────
    // PASO 2: Agrupar intentos por (phaseId, weightClass, registrationId)
    // y calcular bestSnatch, bestCleanAndJerk, total y desempate
    // ─────────────────────────────────────────────────────────────────────
    const athleteMap = new Map<string, AthleteResult>();

    for (const row of rawRows) {
      const key = `${row.phaseId}::${row.weightClass ?? 'open'}::${row.registrationId}`;

      if (!athleteMap.has(key)) {
        athleteMap.set(key, {
          registrationId: row.registrationId,
          phaseId: row.phaseId,
          weightClass: row.weightClass,
          institutionId: row.institutionId,
          institutionName: row.institutionName,
          institutionLogoUrl: row.institutionLogoUrl,
          bestSnatch: null,
          bestCleanAndJerk: null,
          total: null,
          totalAchievedAtAttempt: null,
        });
      }

      const athlete = athleteMap.get(key)!;

      if (row.result === 'valid' && row.weightKg !== null) {
        const kg = Number(row.weightKg);
        if (row.liftType === 'snatch') {
          if (athlete.bestSnatch === null || kg > athlete.bestSnatch) {
            athlete.bestSnatch = kg;
          }
        } else {
          if (athlete.bestCleanAndJerk === null || kg > athlete.bestCleanAndJerk) {
            athlete.bestCleanAndJerk = kg;
          }
        }
      }
    }

    // Calcular totales y desempate (número de intento en que se logró el total)
    // Snatch intentos 1-3, C&J intentos 4-6 en la escala global IWF
    for (const [key, athlete] of athleteMap) {
      if (athlete.bestSnatch !== null && athlete.bestCleanAndJerk !== null) {
        athlete.total = athlete.bestSnatch + athlete.bestCleanAndJerk;
      }

      // Calcular el intento global en que se completó el total (desempate W3)
      const athleteRows = rawRows.filter(
        (r) =>
          r.registrationId === athlete.registrationId &&
          r.phaseId === athlete.phaseId,
      );
      const lastSnatch = [...athleteRows]
        .filter((r) => r.liftType === 'snatch' && r.result === 'valid')
        .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
      const lastCnj = [...athleteRows]
        .filter((r) => r.liftType === 'clean_and_jerk' && r.result === 'valid')
        .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];

      if (lastSnatch && lastCnj) {
        const snatchGlobal = lastSnatch.attemptNumber;
        const cnjGlobal    = lastCnj.attemptNumber + 3; // cnj intento 1 = posición global 4
        athlete.totalAchievedAtAttempt = Math.max(snatchGlobal, cnjGlobal);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 3: Agrupar por (phaseId, weightClass) → categoria independiente
    // Ordenar por: total DESC (null al final), luego totalAchievedAtAttempt ASC
    // Asignar pos 1, 2, 3 → oro, plata, bronce (un solo bronce por categoría)
    // ─────────────────────────────────────────────────────────────────────
    const categoryMap = new Map<string, AthleteResult[]>();
    for (const athlete of athleteMap.values()) {
      const catKey = `${athlete.phaseId}::${athlete.weightClass ?? 'open'}`;
      if (!categoryMap.has(catKey)) categoryMap.set(catKey, []);
      categoryMap.get(catKey)!.push(athlete);
    }

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

    const ensureInstitution = (athlete: AthleteResult) => {
      if (!accumulator.has(athlete.institutionId)) {
        accumulator.set(athlete.institutionId, {
          institutionId: athlete.institutionId,
          institutionName: athlete.institutionName,
          institutionLogoUrl: athlete.institutionLogoUrl,
          gold: 0,
          silver: 0,
          bronze: 0,
        });
      }
      return accumulator.get(athlete.institutionId)!;
    };

    for (const athletes of categoryMap.values()) {
      const count = athletes.length;
      if (count < 2) continue; // W2: categoría con 1 atleta → sin medalla

      // Ordenar: con total primero (por total DESC, luego desempate ASC),
      // después los sin total (W2)
      const ranked = [...athletes].sort((a, b) => {
        const aHasTotal = a.total !== null;
        const bHasTotal = b.total !== null;
        if (aHasTotal && !bHasTotal) return -1;
        if (!aHasTotal && bHasTotal) return 1;
        if (!aHasTotal && !bHasTotal) return 0;
        if (b.total! !== a.total!) return b.total! - a.total!;
        // Desempate W3: menor número de intento global gana
        const aAttempt = a.totalAchievedAtAttempt ?? 99;
        const bAttempt = b.totalAchievedAtAttempt ?? 99;
        return aAttempt - bAttempt;
      });

      // Solo los 3 primeros CON total reciben medalla
      const withTotal = ranked.filter((a) => a.total !== null);

      if (withTotal.length >= 1) ensureInstitution(withTotal[0]).gold   += 1;
      if (withTotal.length >= 2) ensureInstitution(withTotal[1]).silver += 1;
      if (withTotal.length >= 3) ensureInstitution(withTotal[2]).bronze += 1;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 4: Ordenar y asignar rank con soporte de empates
    // ─────────────────────────────────────────────────────────────────────
    const sorted = [...accumulator.values()].sort((a, b) => {
      if (b.gold   !== a.gold)   return b.gold   - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      return b.bronze - a.bronze;
    });

    let currentRank = 1;
    const general: WeightliftingMedalRow[] = sorted.map((row, idx) => {
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
  ): Promise<WeightliftingMedalDetailResponse> {
    const rawRows: Array<{
      registrationId: number;
      phaseId: number;
      phaseName: string;
      weightClass: string | null;
      athleteName: string;
      institutionId: number;
      institutionName: string;
      liftType: 'snatch' | 'clean_and_jerk';
      weightKg: number | null;
      result: string;
      attemptNumber: number;
    }> = await this.dataSource.query(
      `
      SELECT
        reg.registration_id                                       AS registrationId,
        m.phase_id                                                AS phaseId,
        ph.name                                                    AS phaseName,
        reg.weight_class                                          AS weightClass,
        COALESCE(a.name, tm.name, 'N/A')                          AS athleteName,
        COALESCE(inst.institution_id, t_inst.institution_id, 0)   AS institutionId,
        COALESCE(inst.name, t_inst.name, 'N/A')                   AS institutionName,
        wa.lift_type                                              AS liftType,
        wa.weight_kg                                              AS weightKg,
        wa.result                                                 AS result,
        wa.attempt_number                                         AS attemptNumber
      FROM weightlifting_attempts wa
      INNER JOIN participations p
        ON p.participation_id = wa.participation_id
      INNER JOIN matches m
        ON m.match_id = p.match_id
        AND m.deleted_at IS NULL
      INNER JOIN phases ph
        ON ph.phase_id = m.phase_id
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
      WHERE COALESCE(inst.institution_id, t_inst.institution_id, 0) = ?
      ORDER BY reg.registration_id, wa.lift_type, wa.attempt_number
      `,
      [externalEventId, localSportId, institutionId],
    );

    if (rawRows.length === 0) {
      return { institutionId, institutionName: 'N/A', athletes: [] };
    }

    // Reutiliza la misma lógica de agregación de getMedalSummary,
    // pero filtrada a un solo institutionId
    const athleteMap = new Map<string, {
      registrationId: number;
      athleteName: string;
      phaseId: number;
      phaseName: string;
      weightClass: string | null;
      bestSnatch: number | null;
      bestCleanAndJerk: number | null;
      total: number | null;
    }>();

    for (const row of rawRows) {
      const key = `${row.phaseId}::${row.weightClass ?? 'open'}::${row.registrationId}`;
      if (!athleteMap.has(key)) {
        athleteMap.set(key, {
          registrationId: row.registrationId,
          athleteName: row.athleteName,
          phaseId: row.phaseId,
          phaseName: row.phaseName,
          weightClass: row.weightClass,
          bestSnatch: null,
          bestCleanAndJerk: null,
          total: null,
        });
      }
      const athlete = athleteMap.get(key)!;
      if (row.result === 'valid' && row.weightKg !== null) {
        const kg = Number(row.weightKg);
        if (row.liftType === 'snatch') {
          if (athlete.bestSnatch === null || kg > athlete.bestSnatch) athlete.bestSnatch = kg;
        } else {
          if (athlete.bestCleanAndJerk === null || kg > athlete.bestCleanAndJerk) athlete.bestCleanAndJerk = kg;
        }
      }
    }

    for (const athlete of athleteMap.values()) {
      if (athlete.bestSnatch !== null && athlete.bestCleanAndJerk !== null) {
        athlete.total = athlete.bestSnatch + athlete.bestCleanAndJerk;
      }
    }

    // Para saber la medalla real, necesitamos el ranking dentro de TODA la categoría,
    // no solo de esta institución. Por eso volvemos a llamar getMedalSummary
    // internamente y cruzamos qué registrationId ganó qué medalla.
    const allAthleteRows: Array<{ registrationId: number; phaseId: number; weightClass: string | null; institutionId: number; total: number | null }> =
      await this.dataSource.query(
        `
        SELECT
          reg.registration_id AS registrationId,
          m.phase_id AS phaseId,
          reg.weight_class AS weightClass,
          COALESCE(inst.institution_id, t_inst.institution_id, 0) AS institutionId
        FROM weightlifting_attempts wa
        INNER JOIN participations p ON p.participation_id = wa.participation_id
        INNER JOIN matches m ON m.match_id = p.match_id AND m.deleted_at IS NULL
        INNER JOIN phases ph ON ph.phase_id = m.phase_id AND ph.deleted_at IS NULL
        INNER JOIN event_categories ec ON ec.event_category_id = ph.event_category_id AND ec.external_event_id = ?
        INNER JOIN categories cat ON cat.category_id = ec.category_id AND cat.deleted_at IS NULL
        INNER JOIN sports s ON s.sport_id = cat.sport_id AND s.sport_id = ?
        INNER JOIN registrations reg ON reg.registration_id = p.registration_id AND reg.deleted_at IS NULL
        LEFT JOIN athletes a ON a.athlete_id = reg.athlete_id AND a.deleted_at IS NULL
        LEFT JOIN institutions inst ON inst.institution_id = a.institution_id
        LEFT JOIN teams tm ON tm.team_id = reg.team_id
        LEFT JOIN institutions t_inst ON t_inst.institution_id = tm.institution_id
        GROUP BY reg.registration_id, m.phase_id, reg.weight_class, institutionId
        `,
        [externalEventId, localSportId],
      );

    const categoryGroups = new Map<string, typeof allAthleteRows>();
    for (const row of allAthleteRows) {
      const key = `${row.phaseId}::${row.weightClass ?? 'open'}`;
      if (!categoryGroups.has(key)) categoryGroups.set(key, []);
      categoryGroups.get(key)!.push(row);
    }

    const medalByRegistration = new Map<number, 'gold' | 'silver' | 'bronze'>();
    for (const [catKey, group] of categoryGroups) {
      // Recalcular totales de todos los atletas de esa categoría
      const totalsInCategory = group
        .map((r) => {
          const rows = rawRows.filter((rr) => rr.registrationId === r.registrationId && rr.phaseId === r.phaseId);
          let bestSnatch: number | null = null;
          let bestCnj: number | null = null;
          for (const rr of rows) {
            if (rr.result === 'valid' && rr.weightKg !== null) {
              const kg = Number(rr.weightKg);
              if (rr.liftType === 'snatch' && (bestSnatch === null || kg > bestSnatch)) bestSnatch = kg;
              if (rr.liftType === 'clean_and_jerk' && (bestCnj === null || kg > bestCnj)) bestCnj = kg;
            }
          }
          const total = bestSnatch !== null && bestCnj !== null ? bestSnatch + bestCnj : null;
          return { registrationId: r.registrationId, total };
        })
        .filter((r) => r.total !== null)
        .sort((a, b) => b.total! - a.total!);

      if (totalsInCategory[0]) medalByRegistration.set(totalsInCategory[0].registrationId, 'gold');
      if (totalsInCategory[1]) medalByRegistration.set(totalsInCategory[1].registrationId, 'silver');
      if (totalsInCategory[2]) medalByRegistration.set(totalsInCategory[2].registrationId, 'bronze');
    }

    const athletes: WeightliftingMedalDetailRow[] = [...athleteMap.values()]
      .filter((a) => medalByRegistration.has(a.registrationId))
      .map((a) => ({
        registrationId: a.registrationId,
        athleteName: a.athleteName,
        weightClass: a.weightClass,
        phaseName: a.phaseName,
        bestSnatch: a.bestSnatch,
        bestCleanAndJerk: a.bestCleanAndJerk,
        total: a.total,
        medalType: medalByRegistration.get(a.registrationId)!,
      }));

    return {
      institutionId,
      institutionName: rawRows[0]?.institutionName ?? 'N/A',
      athletes,
    };
  }


  async getWeightliftingPhasePodium(phaseId: number): Promise<{
    phaseId: number;
    phaseName: string;
    weightClasses: {
      weightClass: string;
      podium: {
        position: number;
        medal: 'gold' | 'silver' | 'bronze';
        registrationId: number;
        athleteName: string;
        institutionName: string | null;
        institutionAbrev: string | null;
        logoUrl: string | null;
        photoUrl: string | null;
        bestSnatch: number | null;
        bestCleanAndJerk: number | null;
        total: number | null;
      }[];
    }[];
  }> {
    const rows: any[] = await this.dataSource.query(
      `SELECT
        wmr.registration_id         AS registrationId,
        wmr.manual_rank_position    AS position,
        wmr.weight_class            AS weightClass,
        ph.name                     AS phaseName,
        COALESCE(a.name, tm.name)   AS athleteName,
        COALESCE(a.photo_url, NULL) AS photoUrl,
        COALESCE(inst.name, t_inst.name)           AS institutionName,
        COALESCE(inst.abrev, t_inst.abrev)         AS institutionAbrev,
        COALESCE(inst.logo_url, t_inst.logo_url)   AS logoUrl,
        -- totales calculados desde los intentos reales
        SUM(CASE WHEN wa.lift_type = 'snatch'        AND wa.result = 'valid' THEN wa.weight_kg END) AS rawBestSnatch,
        SUM(CASE WHEN wa.lift_type = 'clean_and_jerk' AND wa.result = 'valid' THEN wa.weight_kg END) AS rawBestCnj
      FROM weightlifting_phase_manual_ranks wmr
      INNER JOIN phases ph
        ON ph.phase_id = wmr.phase_id
      INNER JOIN registrations reg
        ON reg.registration_id = wmr.registration_id
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
      -- intentos para mostrar bestSnatch / bestCnj / total en el podio
      LEFT JOIN participations p
        ON p.registration_id = reg.registration_id
      LEFT JOIN matches mx
        ON mx.match_id = p.match_id
        AND mx.phase_id = wmr.phase_id
        AND mx.deleted_at IS NULL
      LEFT JOIN weightlifting_attempts wa
        ON wa.participation_id = p.participation_id
      WHERE wmr.phase_id = ?
        AND wmr.manual_rank_position IN (1, 2, 3)
      GROUP BY
        wmr.registration_id, wmr.manual_rank_position, wmr.weight_class,
        ph.name, athleteName, photoUrl,
        institutionName, institutionAbrev, logoUrl
      ORDER BY wmr.weight_class ASC, wmr.manual_rank_position ASC`,
      [phaseId],
    );

    if (rows.length === 0) {
      return { phaseId, phaseName: '', weightClasses: [] };
    }

    const MEDAL_MAP: Record<number, 'gold' | 'silver' | 'bronze'> = {
      1: 'gold', 2: 'silver', 3: 'bronze',
    };

    // Agrupar por weightClass
    const classMap = new Map<string, typeof rows>();
    for (const row of rows) {
      const wc = row.weightClass ?? 'Abierto';
      if (!classMap.has(wc)) classMap.set(wc, []);
      classMap.get(wc)!.push(row);
    }

    const phaseName: string = rows[0].phaseName ?? '';

    const weightClasses = [...classMap.entries()].map(([weightClass, entries]) => ({
      weightClass,
      podium: entries.map((r) => {
        const bestSnatch = r.rawBestSnatch !== null ? Number(r.rawBestSnatch) : null;
        const bestCnj    = r.rawBestCnj    !== null ? Number(r.rawBestCnj)    : null;
        return {
          position:         r.position,
          medal:            MEDAL_MAP[r.position],
          registrationId:   r.registrationId,
          athleteName:      r.athleteName ?? 'Sin nombre',
          institutionName:  r.institutionName ?? null,
          institutionAbrev: r.institutionAbrev ?? null,
          logoUrl:          r.logoUrl ?? null,
          photoUrl:         r.photoUrl ?? null,
          bestSnatch,
          bestCleanAndJerk: bestCnj,
          total: bestSnatch !== null && bestCnj !== null ? bestSnatch + bestCnj : null,
        };
      }),
    }));

    return { phaseId, phaseName, weightClasses };
  }

}