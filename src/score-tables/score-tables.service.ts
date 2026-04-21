// src/score-tables/score-tables.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ScoreTable } from './entities/score-table.entity';
import { AccumulateScoreDto } from './dto/accumulate-score.dto';
import { PhaseGender, PhaseLevel } from '../common/enums';
import { ScoreRow, ScoreSummaryResponse } from './dto/score-summary-response.dto';

// Tabla oficial FEDUP (regla 3.5.3)
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
  // Llamado cuando se registra un resultado final con rank_position
  // ─────────────────────────────────────────────────────────────────────────
  async accumulateScore(dto: AccumulateScoreDto): Promise<void> {
    const basePoints = POINTS_BY_RANK[dto.rankPosition] ?? 0;
    if (basePoints === 0) return; // Posición fuera del top 8, no puntúa

    const points = dto.isRelayOrCombined ? basePoints * 2 : basePoints; // Regla 3.5.3

    const isMixedRelay = dto.gender === PhaseGender.MIXTO || dto.level === null;

    if (isMixedRelay) {
      // Regla 3.5.4: postas mixtas → solo al puntaje general
      // Se guarda con gender=null, level=null → lo sumamos en el general
      await this.upsertScore({
        eventId: dto.eventId,
        institutionId: dto.institutionId,
        externalInstitutionId: dto.externalInstitutionId ?? null,
        institutionName: dto.institutionName,
        gender: null,
        level: null,
        points,
        rankPosition: dto.rankPosition,
      });
    } else {
      // Prueba normal: acumula en su combinación gender+level
      await this.upsertScore({
        eventId: dto.eventId,
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
  // INSERT ... ON DUPLICATE KEY UPDATE (upsert manual)
  // ─────────────────────────────────────────────────────────────────────────
  private async upsertScore(params: {
    eventId: number;
    institutionId: number;
    externalInstitutionId: number | null;
    institutionName: string;
    gender: PhaseGender | null;
    level: PhaseLevel | null;
    points: number;
    rankPosition: number;
  }): Promise<void> {
    const { eventId, institutionId, externalInstitutionId, institutionName, gender, level, points, rankPosition } = params;

    const goldDelta   = rankPosition === 1 ? 1 : 0;
    const silverDelta = rankPosition === 2 ? 1 : 0;
    const bronzeDelta = rankPosition === 3 ? 1 : 0;

    // TypeORM no soporta ON DUPLICATE KEY UPDATE nativamente, usamos query raw
    await this.repo.query(
      `INSERT INTO score_table
         (event_id, institution_id, external_institution_id, institution_name,
          gender, level, total_points, gold_count, silver_count, bronze_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_points  = total_points  + VALUES(total_points),
         gold_count    = gold_count    + VALUES(gold_count),
         silver_count  = silver_count  + VALUES(silver_count),
         bronze_count  = bronze_count  + VALUES(bronze_count),
         institution_name = VALUES(institution_name)`,
      [
        eventId, institutionId, externalInstitutionId, institutionName,
        gender, level, points,
        goldDelta, silverDelta, bronzeDelta,
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recalcular toda la score_table de un evento desde cero
  // Útil si editas resultados retroactivamente
  // ─────────────────────────────────────────────────────────────────────────
  async recalculateEvent(eventId: number): Promise<void> {
    // 1. Borrar registros actuales del evento
    await this.repo.delete({ eventId });

    // 2. Obtener todos los rank_position finales del evento
    //    (solo phases que pertenezcan al evento y tengan rankPosition registrado)
    const rankRows: Array<{
      institutionId: number;
      externalInstitutionId: number;
      institutionName: string;
      gender: PhaseGender | null;
      level: PhaseLevel | null;
      isRelay: boolean;
      rankPosition: number;
      phaseType: string;
    }> = await this.repo.query(
      `SELECT
         COALESCE(a.institution_id, 0)              AS institutionId,
         reg.external_institution_id                AS externalInstitutionId,
         COALESCE(inst.name, sm.short_name, 'N/A')  AS institutionName,
         ph.gender,
         ph.level,
         ph.is_relay                                AS isRelay,
         ar.rank_position                           AS rankPosition,
         ph.type                                    AS phaseType
       FROM athletics_result ar
         INNER JOIN phase_registrations pr ON pr.phase_registration_id = ar.phase_registration_id
         INNER JOIN phases ph              ON ph.phase_id = pr.phase_id
         INNER JOIN event_categories ec   ON ec.event_category_id = ph.event_category_id
         INNER JOIN registrations reg     ON reg.registration_id = pr.registration_id
         LEFT  JOIN athletes a            ON a.athlete_id = reg.athlete_id
         LEFT  JOIN institutions inst     ON inst.institution_id = a.institution_id
       WHERE ec.event_id = ?
         AND ar.rank_position IS NOT NULL
         AND ar.rank_position BETWEEN 1 AND 8
         AND ph.deleted_at IS NULL
         AND reg.deleted_at IS NULL`,
      [eventId],
    );

    // 3. Re-acumular cada fila
    for (const row of rankRows) {
      const isCombined = ['combined_pista', 'combined_distancia', 'combined_altura'].includes(row.phaseType);
      await this.accumulateScore({
        eventId,
        institutionId: row.institutionId,
        externalInstitutionId: row.externalInstitutionId,
        institutionName: row.institutionName,
        gender: row.gender,
        level: row.level,
        rankPosition: row.rankPosition,
        isRelayOrCombined: row.isRelay || isCombined,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Obtener las 5 tablas de un evento
  // ─────────────────────────────────────────────────────────────────────────
  async getScoreSummary(eventId: number): Promise<ScoreSummaryResponse> {
    const [general, damas, varones, noveles, avanzados] = await Promise.all([
      this.getGeneralTable(eventId),
      this.getFilteredTable(eventId, PhaseGender.DAMAS, null),
      this.getFilteredTable(eventId, PhaseGender.VARONES, null),
      this.getFilteredTable(eventId, null, PhaseLevel.NOVELES),
      this.getFilteredTable(eventId, null, PhaseLevel.AVANZADOS),
    ]);

    return { general, damas, varones, noveles, avanzados };
  }

  // General = suma TODOS los rows del evento por institución (incluye mixtas)
  private async getGeneralTable(eventId: number): Promise<ScoreRow[]> {
    const rows = await this.repo
      .createQueryBuilder('st')
      .select('st.institutionId',   'institutionId')
      .addSelect('st.institutionName', 'institutionName')
      .addSelect('SUM(st.totalPoints)', 'points')
      .addSelect('SUM(st.goldCount)',   'gold')
      .addSelect('SUM(st.silverCount)', 'silver')
      .addSelect('SUM(st.bronzeCount)', 'bronze')
      .where('st.eventId = :eventId', { eventId })
      .groupBy('st.institutionId')
      .addGroupBy('st.institutionName')
      .orderBy('points',  'DESC')
      .addOrderBy('gold',   'DESC')   // Regla 3.5.6: desempate por 1ros puestos
      .addOrderBy('silver', 'DESC')
      .addOrderBy('bronze', 'DESC')
      .getRawMany();

    return this.addRankWithTiebreaker(rows);
  }

  // Damas/Varones: filtra por gender, suma ambos levels
  // Noveles/Avanzados: filtra por level, suma ambos genders
  private async getFilteredTable(
    eventId: number,
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
      .where('st.eventId = :eventId', { eventId });

    if (gender !== null) {
      qb.andWhere('st.gender = :gender', { gender });
    }
    if (level !== null) {
      qb.andWhere('st.level = :level', { level });
    }

    // Excluir postas mixtas (gender=null, level=null) de damas/varones/noveles/avanzados
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

  // Asigna posición manejando empates (mismo puesto si puntos iguales)
  private addRankWithTiebreaker(rows: any[]): ScoreRow[] {
    let currentRank = 1;
    return rows.map((row, index) => {
      if (index > 0) {
        const prev = rows[index - 1];
        const samePoints = Number(row.points)  === Number(prev.points);
        const sameGold   = Number(row.gold)    === Number(prev.gold);
        const sameSilver = Number(row.silver)  === Number(prev.silver);
        const sameBronze = Number(row.bronze)  === Number(prev.bronze);
        if (!(samePoints && sameGold && sameSilver && sameBronze)) {
          currentRank = index + 1;
        }
      }
      return {
        rank: currentRank,
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