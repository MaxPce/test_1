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
      await this.upsertScore({
        externalEventId:       dto.externalEventId,
        externalSportId:       dto.externalSportId,
        localSportId:    dto.localSportId,
        institutionId:         dto.institutionId,
        externalInstitutionId: dto.externalInstitutionId ?? null,
        institutionName:       dto.institutionName,
        gender:      null,
        level:       null,
        points,
        rankPosition: dto.rankPosition,
      });
    } else {
      await this.upsertScore({
        externalEventId:       dto.externalEventId,
        externalSportId:       dto.externalSportId,
        localSportId:    dto.localSportId,
        institutionId:         dto.institutionId,
        externalInstitutionId: dto.externalInstitutionId ?? null,
        institutionName:       dto.institutionName,
        gender:      dto.gender,
        level:       dto.level,
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
    externalSportId: number;
    localSportId: number;
    institutionId: number;
    externalInstitutionId: number | null;
    institutionName: string;
    gender: PhaseGender | null;
    level: PhaseLevel | null;
    points: number;
    rankPosition: number;
  }): Promise<void> {
    const {
      externalEventId, externalSportId, localSportId, institutionId, externalInstitutionId,
      institutionName, gender, level, points, rankPosition,
    } = params;

    const goldDelta   = rankPosition === 1 ? 1 : 0;
    const silverDelta = rankPosition === 2 ? 1 : 0;
    const bronzeDelta = rankPosition === 3 ? 1 : 0;

    await this.repo.query(
      `INSERT INTO score_table
        (external_event_id, external_sport_id, local_sport_id,
          institution_id, external_institution_id, institution_name,
          gender, level, total_points, gold_count, silver_count, bronze_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_points     = total_points  + VALUES(total_points),
        gold_count       = gold_count    + VALUES(gold_count),
        silver_count     = silver_count  + VALUES(silver_count),
        bronze_count     = bronze_count  + VALUES(bronze_count),
        institution_name = VALUES(institution_name)`,
      [
        externalEventId, externalSportId, localSportId,          
        institutionId, externalInstitutionId, institutionName,
        gender, level, points,
        goldDelta, silverDelta, bronzeDelta,
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recalcular desde cero (borra y re-acumula)
  // ─────────────────────────────────────────────────────────────────────────
  async recalculateEvent(externalEventId: number, localSportId: number): Promise<void> {
    await this.repo.delete({ externalEventId, localSportId });

    const rankRows: Array<{
      institutionId: number;
      externalInstitutionId: number | null;
      institutionName: string;
      gender: PhaseGender | null;
      level: PhaseLevel | null;
      isRelay: boolean;
      rankPosition: number;
      phaseType: string;
      localSportId: number;       
      externalSportId: number;
    }> = await this.repo.query(
      `SELECT
         reg.external_institution_id                AS institutionId,
         reg.external_institution_id                AS externalInstitutionId,
         COALESCE(inst.name, t_inst.name, 'N/A')    AS institutionName,
         ph.gender,
         ph.level,
         ph.is_relay                                AS isRelay,
         apc.rank_position                          AS rankPosition,
         ph.type                                    AS phaseType,
         COALESCE(s.sport_id, 0)                    AS localSportId,         
          COALESCE(ec.external_sport_id, 0)          AS externalSportId
       FROM athletics_phase_classification apc
          INNER JOIN phase_registrations pr ON pr.phase_registration_id = apc.phase_registration_id
          INNER JOIN phases ph              ON ph.phase_id = apc.phase_id
          INNER JOIN event_categories ec    ON ec.event_category_id = ph.event_category_id
          LEFT  JOIN sports s               ON s.sismaster_sport_id = ec.external_sport_id  
          INNER JOIN registrations reg      ON reg.registration_id = pr.registration_id
          LEFT  JOIN athletes a             ON a.athlete_id = reg.athlete_id
          LEFT  JOIN institutions inst      ON inst.institution_id = a.institution_id
          LEFT  JOIN teams tm               ON tm.team_id = reg.team_id
          LEFT  JOIN institutions t_inst    ON t_inst.institution_id = tm.institution_id
        WHERE ec.external_event_id = ?
          AND s.sport_id = ? 
         AND apc.is_scoring_eligible = 1
         AND apc.points_awarded > 0
         AND apc.rank_position IS NOT NULL
         AND apc.rank_position BETWEEN 1 AND 8`,
      [externalEventId, localSportId],
    );

    for (const row of rankRows) {
      const isCombined = ['COMBINED_PISTA', 'COMBINED_DISTANCIA', 'COMBINED_ALTURA']
        .includes(row.phaseType);

      await this.accumulateScore({
        externalEventId,
        externalSportId: Number(row.externalSportId),  
        localSportId:    Number(row.localSportId),
        institutionId:         row.institutionId,
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
  // Las 5 tablas de clasificación
  // ─────────────────────────────────────────────────────────────────────────
  async getScoreSummary(externalEventId: number, localSportId: number) {
    const [general, damas, varones, noveles, avanzados] = await Promise.all([
      this.getGeneralTable(externalEventId, localSportId),
      this.getFilteredTable(externalEventId, localSportId, PhaseGender.DAMAS,   null),
      this.getFilteredTable(externalEventId, localSportId, PhaseGender.VARONES, null),
      this.getFilteredTable(externalEventId, localSportId, null, PhaseLevel.NOVELES),
      this.getFilteredTable(externalEventId, localSportId, null, PhaseLevel.AVANZADOS),
    ]);
    return { general, damas, varones, noveles, avanzados };
  }



  private async getGeneralTable(
    externalEventId: number,
    localSportId: number,
  ): Promise<ScoreRow[]> {
    const rows = await this.repo
      .createQueryBuilder('st')
      .select('st.institutionId',       'institutionId')
      .addSelect('st.institutionName',  'institutionName')
      .addSelect('SUM(st.totalPoints)', 'points')
      .addSelect('SUM(st.goldCount)',   'gold')
      .addSelect('SUM(st.silverCount)', 'silver')
      .addSelect('SUM(st.bronzeCount)', 'bronze')
      .where(
        'st.externalEventId = :externalEventId AND st.localSportId = :localSportId',
        { externalEventId, localSportId },
      )
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
    localSportId: number,
    gender: PhaseGender | null,
    level: PhaseLevel | null,
  ): Promise<ScoreRow[]> {
    const qb = this.repo
      .createQueryBuilder('st')
      .select('st.institutionId',       'institutionId')
      .addSelect('st.institutionName',  'institutionName')
      .addSelect('SUM(st.totalPoints)', 'points')
      .addSelect('SUM(st.goldCount)',   'gold')
      .addSelect('SUM(st.silverCount)', 'silver')
      .addSelect('SUM(st.bronzeCount)', 'bronze')
      .where(
        'st.externalEventId = :externalEventId AND st.localSportId = :localSportId',
        { externalEventId, localSportId },
      );

    if (gender !== null) qb.andWhere('st.gender = :gender', { gender });
    if (level  !== null) qb.andWhere('st.level  = :level',  { level });

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