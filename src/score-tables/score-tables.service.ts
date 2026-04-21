// src/score-tables/score-tables.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScoreTable } from './entities/score-table.entity';
import { AccumulateScoreDto } from './dto/accumulate-score.dto';
import { PhaseGender, PhaseLevel } from '../common/enums';
import { ScoreRow, ScoreSummaryResponse } from './dto/score-summary-response.dto';

const POINTS_BY_RANK: Record<number, number> = {
  1: 10, 2: 8, 3: 6, 4: 5,
  5: 4,  6: 3, 7: 2, 8: 1,
};

@Injectable()
export class ScoreTablesService {
  constructor(
    @InjectRepository(ScoreTable)
    private readonly repo: Repository<ScoreTable>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Acumular puntaje de un atleta/equipo
  // ─────────────────────────────────────────────────────────────────────────
  async accumulateScore(dto: AccumulateScoreDto): Promise<void> {
    const basePoints = POINTS_BY_RANK[dto.rankPosition] ?? 0;
    if (basePoints === 0) return;

    const points = dto.isRelayOrCombined ? basePoints * 2 : basePoints;
    const isMixedRelay = dto.gender === PhaseGender.MIXTO || dto.level === null;

    if (isMixedRelay) {
      // Regla 3.5.4: postas mixtas → solo al puntaje general (gender=null, level=null)
      await this.upsertScore({
        externalEventId: dto.externalEventId,
        institutionId: dto.institutionId,
        externalInstitutionId: dto.externalInstitutionId ?? null,
        institutionName: dto.institutionName,
        gender: null,
        level: null,
        points,
        rankPosition: dto.rankPosition,
      });
    } else {
      await this.upsertScore({
        externalEventId: dto.externalEventId,
        institutionId: dto.institutionId,
        externalInstitutionId: dto.externalInstitutionId ?? null,
        institutionName: dto.institutionName,
        gender: dto.gender,
        level: dto.level,
        points,
        rankPosition: dto.rankPosition,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INSERT ... ON DUPLICATE KEY UPDATE
  // ─────────────────────────────────────────────────────────────────────────
  private async upsertScore(params: {
    externalEventId: number;
    institutionId: number;
    externalInstitutionId: number | null;
    institutionName: string;
    gender: PhaseGender | null;
    level: PhaseLevel | null;
    points: number;
    rankPosition: number;
  }): Promise<void> {
    const {
      externalEventId, institutionId, externalInstitutionId,
      institutionName, gender, level, points, rankPosition,
    } = params;

    const goldDelta   = rankPosition === 1 ? 1 : 0;
    const silverDelta = rankPosition === 2 ? 1 : 0;
    const bronzeDelta = rankPosition === 3 ? 1 : 0;

    await this.repo.query(
      `INSERT INTO score_table
         (external_event_id, institution_id, external_institution_id, institution_name,
          gender, level, total_points, gold_count, silver_count, bronze_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_points     = total_points  + VALUES(total_points),
         gold_count       = gold_count    + VALUES(gold_count),
         silver_count     = silver_count  + VALUES(silver_count),
         bronze_count     = bronze_count  + VALUES(bronze_count),
         institution_name = VALUES(institution_name)`,
      [
        externalEventId, institutionId, externalInstitutionId, institutionName,
        gender, level, points,
        goldDelta, silverDelta, bronzeDelta,
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recalcular score_table completo desde athletics_phase_classification
  // Seguro de ejecutar N veces — borra y re-acumula desde cero
  // ─────────────────────────────────────────────────────────────────────────
  async recalculateEvent(externalEventId: number): Promise<void> {
    // 1. Borrar registros actuales del evento
    await this.repo.delete({ externalEventId });

    // 2. Leer todas las clasificaciones desde athletics_phase_classification
    const rankRows: Array<{
        institutionId: number;
        externalInstitutionId: number | null;
        institutionName: string;
        gender: PhaseGender | null;
        level: PhaseLevel | null;
        isRelay: boolean;
        rankPosition: number;
        phaseType: string;
    }> = await this.repo.query(
        `SELECT
        reg.external_institution_id                  AS institutionId,
        reg.external_institution_id                  AS externalInstitutionId,
        COALESCE(inst.name, t_inst.name, 'N/A')      AS institutionName,
        ph.gender,
        ph.level,
        ph.is_relay                                  AS isRelay,
        apc.rank_position                            AS rankPosition,
        ph.type                                      AS phaseType
        FROM athletics_phase_classification apc
        INNER JOIN phase_registrations pr  ON pr.phase_registration_id = apc.phase_registration_id
        INNER JOIN phases ph               ON ph.phase_id = apc.phase_id
        INNER JOIN event_categories ec     ON ec.event_category_id = ph.event_category_id
        INNER JOIN registrations reg       ON reg.registration_id = pr.registration_id
        LEFT  JOIN athletes a              ON a.athlete_id = reg.athlete_id
        LEFT  JOIN institutions inst       ON inst.institution_id = a.institution_id
        LEFT  JOIN teams tm                ON tm.team_id = reg.team_id
        LEFT  JOIN institutions t_inst     ON t_inst.institution_id = tm.institution_id
        WHERE ec.external_event_id = ?
        AND apc.is_scoring_eligible = 1
        AND apc.points_awarded > 0
        AND apc.rank_position IS NOT NULL
        AND apc.rank_position BETWEEN 1 AND 8`,
        [externalEventId],
    );

    // 3. Re-acumular cada fila
    for (const row of rankRows) {
        const isCombined = ['COMBINED_PISTA', 'COMBINED_DISTANCIA', 'COMBINED_ALTURA']
        .includes(row.phaseType);

        await this.accumulateScore({
        externalEventId,
        institutionId:         row.institutionId,       // ← external_institution_id
        externalInstitutionId: row.externalInstitutionId,
        institutionName:       row.institutionName,
        gender:                row.gender,
        level:                 row.level,
        rankPosition:          row.rankPosition,
        isRelayOrCombined:     row.isRelay || isCombined,
        });
    }
    }


  // ─────────────────────────────────────────────────────────────────────────
  // Las 5 tablas de clasificación por evento
  // GET /score-tables/external/:externalEventId/summary
  // ─────────────────────────────────────────────────────────────────────────
  async getScoreSummary(externalEventId: number): Promise<ScoreSummaryResponse> {
    const [general, damas, varones, noveles, avanzados] = await Promise.all([
      this.getGeneralTable(externalEventId),
      this.getFilteredTable(externalEventId, PhaseGender.DAMAS, null),
      this.getFilteredTable(externalEventId, PhaseGender.VARONES, null),
      this.getFilteredTable(externalEventId, null, PhaseLevel.NOVELES),
      this.getFilteredTable(externalEventId, null, PhaseLevel.AVANZADOS),
    ]);

    return { general, damas, varones, noveles, avanzados };
  }

  // General = suma TODOS los rows del evento por institución (incluye mixtas)
  private async getGeneralTable(externalEventId: number): Promise<ScoreRow[]> {
    const rows = await this.repo
      .createQueryBuilder('st')
      .select('st.institutionId',      'institutionId')
      .addSelect('st.institutionName', 'institutionName')
      .addSelect('SUM(st.totalPoints)', 'points')
      .addSelect('SUM(st.goldCount)',   'gold')
      .addSelect('SUM(st.silverCount)', 'silver')
      .addSelect('SUM(st.bronzeCount)', 'bronze')
      .where('st.externalEventId = :externalEventId', { externalEventId })
      .groupBy('st.institutionId')
      .addGroupBy('st.institutionName')
      .orderBy('points',  'DESC')
      .addOrderBy('gold',   'DESC')
      .addOrderBy('silver', 'DESC')
      .addOrderBy('bronze', 'DESC')
      .getRawMany();

    return this.addRankWithTiebreaker(rows);
  }

  private async getFilteredTable(
    externalEventId: number,
    gender: PhaseGender | null,
    level: PhaseLevel | null,
  ): Promise<ScoreRow[]> {
    const qb = this.repo
      .createQueryBuilder('st')
      .select('st.institutionId',      'institutionId')
      .addSelect('st.institutionName', 'institutionName')
      .addSelect('SUM(st.totalPoints)', 'points')
      .addSelect('SUM(st.goldCount)',   'gold')
      .addSelect('SUM(st.silverCount)', 'silver')
      .addSelect('SUM(st.bronzeCount)', 'bronze')
      .where('st.externalEventId = :externalEventId', { externalEventId });

    if (gender !== null) qb.andWhere('st.gender = :gender', { gender });
    if (level  !== null) qb.andWhere('st.level = :level',   { level });

    // Excluir postas mixtas (gender=null) de las tablas parciales
    if (gender !== null || level !== null) {
      qb.andWhere('st.gender IS NOT NULL');
    }

    const rows = await qb
      .groupBy('st.institutionId')
      .addGroupBy('st.institutionName')
      .orderBy('points',  'DESC')
      .addOrderBy('gold',   'DESC')
      .addOrderBy('silver', 'DESC')
      .addOrderBy('bronze', 'DESC')
      .getRawMany();

    return this.addRankWithTiebreaker(rows);
  }

  private addRankWithTiebreaker(rows: any[]): ScoreRow[] {
    let currentRank = 1;
    return rows.map((row, index) => {
      if (index > 0) {
        const prev = rows[index - 1];
        const tied =
          Number(row.points) === Number(prev.points) &&
          Number(row.gold)   === Number(prev.gold)   &&
          Number(row.silver) === Number(prev.silver) &&
          Number(row.bronze) === Number(prev.bronze);
        if (!tied) currentRank = index + 1;
      }
      return {
        rank:            currentRank,
        institutionId:   Number(row.institutionId),
        institutionName: row.institutionName,
        points:  Number(row.points),
        gold:    Number(row.gold),
        silver:  Number(row.silver),
        bronze:  Number(row.bronze),
      };
    });
  }
}