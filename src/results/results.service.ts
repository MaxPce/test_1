import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Result, Attempt } from './entities';
import { Match, Participation, Standing } from '../competitions/entities';
import {
  CreateResultDto,
  UpdateResultDto,
  CreateAttemptDto,
  PublishMatchResultDto,
  UpdateLiveScoreDto,
  CreateTimeResultDto,
} from './dto';
import { MatchStatus, PhaseType } from '../common/enums';

@Injectable()
export class ResultsService {
  constructor(
    @InjectRepository(Result)
    private resultRepository: Repository<Result>,
    @InjectRepository(Attempt)
    private attemptRepository: Repository<Attempt>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Participation)
    private participationRepository: Repository<Participation>,
    @InjectRepository(Standing)
    private standingRepository: Repository<Standing>,
    private dataSource: DataSource,
  ) {}

  // ==================== RESULTS ====================

  async createResult(
    createDto: CreateResultDto,
    adminId: number,
  ): Promise<Result> {
    const result = this.resultRepository.create({
      ...createDto,
      recordedBy: adminId,
    });
    return this.resultRepository.save(result);
  }

  async findAllResults(participationId?: number): Promise<Result[]> {
    const queryBuilder = this.resultRepository
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.participation', 'participation')
      .leftJoinAndSelect('participation.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('result.recordedByUser', 'user');

    if (participationId) {
      queryBuilder.andWhere('result.participationId = :participationId', {
        participationId,
      });
    }

    return queryBuilder.orderBy('result.recordedAt', 'DESC').getMany();
  }

  async findOneResult(id: number): Promise<Result> {
    const result = await this.resultRepository.findOne({
      where: { resultId: id },
      relations: [
        'participation',
        'participation.registration',
        'participation.registration.athlete',
        'participation.registration.team',
        'recordedByUser',
      ],
    });

    if (!result) {
      throw new NotFoundException(`Resultado con ID ${id} no encontrado`);
    }

    return result;
  }

  async updateResult(
    id: number,
    updateDto: UpdateResultDto,
    adminId: number,
  ): Promise<Result> {
    const result = await this.findOneResult(id);
    Object.assign(result, updateDto);
    result.recordedBy = adminId;
    return this.resultRepository.save(result);
  }

  async removeResult(id: number): Promise<void> {
    const result = await this.findOneResult(id);
    await this.resultRepository.remove(result);
  }

  // ==================== ATTEMPTS ====================

  async createAttempt(createDto: CreateAttemptDto): Promise<Attempt> {
    // Verificar que no exista ya ese número de intento
    const existing = await this.attemptRepository.findOne({
      where: {
        participationId: createDto.participationId,
        attemptNumber: createDto.attemptNumber,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe el intento número ${createDto.attemptNumber} para esta participación`,
      );
    }

    const attempt = this.attemptRepository.create(createDto);
    return this.attemptRepository.save(attempt);
  }

  async findAttemptsByParticipation(
    participationId: number,
  ): Promise<Attempt[]> {
    return this.attemptRepository.find({
      where: { participationId },
      relations: ['participation'],
      order: { attemptNumber: 'ASC' },
    });
  }

  async updateAttempt(id: number, isValid: boolean): Promise<Attempt> {
    const attempt = await this.attemptRepository.findOne({
      where: { attemptId: id },
    });

    if (!attempt) {
      throw new NotFoundException(`Intento con ID ${id} no encontrado`);
    }

    attempt.isValid = isValid;
    return this.attemptRepository.save(attempt);
  }

  async removeAttempt(id: number): Promise<void> {
    const attempt = await this.attemptRepository.findOne({
      where: { attemptId: id },
    });

    if (!attempt) {
      throw new NotFoundException(`Intento con ID ${id} no encontrado`);
    }

    await this.attemptRepository.remove(attempt);
  }

  // ==================== PUBLISH MATCH RESULTS ====================

  async publishMatchResult(
    dto: PublishMatchResultDto,
    adminId: number,
  ): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Obtener el match con todas sus relaciones
      const match = await queryRunner.manager.findOne(Match, {
        where: { matchId: dto.matchId },
        relations: ['phase', 'phase.eventCategory', 'participations'],
      });

      if (!match) {
        throw new NotFoundException('Match no encontrado');
      }

      // 2. Actualizar estado del match
      match.status = dto.status;
      if (dto.winnerRegistrationId !== undefined) {
        match.winnerRegistrationId = dto.winnerRegistrationId;
      }
      await queryRunner.manager.save(match);

      // 3. Guardar resultados de cada participación
      const savedResults: Result[] = [];
      for (const partResult of dto.participations) {
        // Eliminar resultado anterior si existe
        await queryRunner.manager.delete(Result, {
          participationId: partResult.participationId,
        });

        // Crear nuevo resultado
        const result = queryRunner.manager.create(Result, {
          participationId: partResult.participationId,
          scoreValue: partResult.scoreValue,
          timeValue: partResult.timeValue,
          isWinner: partResult.isWinner,
          rankPosition: partResult.rankPosition,
          recordedBy: adminId,
        });
        const saved = await queryRunner.manager.save(result);
        savedResults.push(saved);
      }

      // 4. Actualizar standings si es round robin
      if (
        match.phase.type === PhaseType.GRUPO &&
        dto.status === MatchStatus.FINALIZADO
      ) {
        await this.updateStandingsAfterMatch(queryRunner, match, dto);
      }

      // 5. Avanzar ganador a siguiente ronda si es eliminación
      if (
        match.phase.type === PhaseType.ELIMINACION &&
        dto.status === MatchStatus.FINALIZADO &&
        dto.winnerRegistrationId
      ) {
        await this.advanceToNextRound(
          queryRunner,
          match,
          dto.winnerRegistrationId,
        );
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        matchId: match.matchId,
        status: match.status,
        results: savedResults,
        message: 'Resultados publicados exitosamente',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async updateStandingsAfterMatch(
    queryRunner: any,
    match: Match,
    dto: PublishMatchResultDto,
  ): Promise<void> {
    for (const partResult of dto.participations) {
      // Obtener la participación para conocer el registrationId
      const participation = await queryRunner.manager.findOne(Participation, {
        where: { participationId: partResult.participationId },
      });

      if (!participation) continue;

      // Buscar o crear standing
      let standing = await queryRunner.manager.findOne(Standing, {
        where: {
          phaseId: match.phaseId,
          registrationId: participation.registrationId,
        },
      });

      if (!standing) {
        standing = queryRunner.manager.create(Standing, {
          phaseId: match.phaseId,
          registrationId: participation.registrationId,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          scoreFor: 0,
          scoreAgainst: 0,
          scoreDiff: 0,
        });
      }

      // Actualizar estadísticas
      standing.matchesPlayed += 1;

      if (partResult.isWinner) {
        standing.wins += 1;
        standing.points += 1;
      } else {
        // Verificar si es empate (ambos no ganadores en combates de puntos iguales)
        const isDraw = dto.participations.every((p) => !p.isWinner);
        if (isDraw) {
          standing.draws += 1;
          standing.points += 0.5;
        } else {
          standing.losses += 1;
        }
      }

      standing.scoreFor += partResult.scoreValue || 0;

      // Calcular score against (suma de scores de otros participantes)
      const otherScores = dto.participations
        .filter((p) => p.participationId !== partResult.participationId)
        .reduce((sum, p) => sum + (p.scoreValue || 0), 0);
      standing.scoreAgainst += otherScores;

      standing.scoreDiff = standing.scoreFor - standing.scoreAgainst;

      await queryRunner.manager.save(standing);
    }

    // Actualizar posiciones después de guardar todos los standings
    await this.recalculateStandingsRanks(queryRunner, match.phaseId);
  }

  private async recalculateStandingsRanks(
    queryRunner: any,
    phaseId: number,
  ): Promise<void> {
    const standings = await queryRunner.manager.find(Standing, {
      where: { phaseId },
      order: {
        points: 'DESC',
        scoreDiff: 'DESC',
        scoreFor: 'DESC',
      },
    });

    let rank = 1;
    for (const standing of standings) {
      standing.rankPosition = rank++;
      await queryRunner.manager.save(standing);
    }
  }

  private async advanceToNextRound(
    queryRunner: any,
    match: Match,
    winnerId: number,
  ): Promise<void> {
    // Lógica para avanzar al ganador a la siguiente ronda
    // Esta es una implementación básica, puede ser más compleja según el bracket

    // Buscar si hay un match de siguiente ronda esperando este resultado
    const nextRoundMatch = await queryRunner.manager
      .createQueryBuilder(Match, 'match')
      .where('match.phaseId = :phaseId', { phaseId: match.phaseId })
      .andWhere('match.matchNumber > :currentMatchNumber', {
        currentMatchNumber: match.matchNumber,
      })
      .andWhere('match.status = :status', { status: MatchStatus.PROGRAMADO })
      .orderBy('match.matchNumber', 'ASC')
      .getOne();

    if (nextRoundMatch) {
      // Verificar si ya tiene 2 participantes
      const existingParticipations = await queryRunner.manager.count(
        Participation,
        {
          where: { matchId: nextRoundMatch.matchId },
        },
      );

      if (existingParticipations < 2) {
        // Agregar el ganador al siguiente match
        const corner = existingParticipations === 0 ? 'blue' : 'white';
        const newParticipation = queryRunner.manager.create(Participation, {
          matchId: nextRoundMatch.matchId,
          registrationId: winnerId,
          corner,
        });
        await queryRunner.manager.save(newParticipation);
      }
    }
  }

  // ==================== LIVE SCORE UPDATE ====================

  async updateLiveScore(
    dto: UpdateLiveScoreDto,
    adminId: number,
  ): Promise<Result> {
    // Buscar resultado existente
    let result = await this.resultRepository.findOne({
      where: { participationId: dto.participationId },
    });

    if (result) {
      // Actualizar existente
      if (dto.scoreValue !== undefined) {
        result.scoreValue = dto.scoreValue;
      }
      if (dto.timeValue !== undefined) {
        result.timeValue = dto.timeValue;
      }
      result.recordedBy = adminId;
    } else {
      
      result = this.resultRepository.create({
        participationId: dto.participationId,
        scoreValue: dto.scoreValue,
        timeValue: dto.timeValue,
        recordedBy: adminId,
      });
    }

    return this.resultRepository.save(result);
  }

  // ==================== MATCH RESULTS VIEW ====================

  async getMatchResults(matchId: number): Promise<any> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: [
        'phase',
        'phase.eventCategory',
        'phase.eventCategory.category',
        'participations',
        'participations.registration',
        'participations.registration.athlete',
        'participations.registration.athlete.institution',
        'participations.registration.team',
        'participations.registration.team.institution',
        'participations.registration.team.members',
        'participations.registration.team.members.athlete',
      ],
    });

    if (!match) {
      throw new NotFoundException('Match no encontrado');
    }

    // Obtener resultados de cada participación
    const participationsWithResults = await Promise.all(
      match.participations.map(async (participation) => {
        const results = await this.resultRepository.find({
          where: { participationId: participation.participationId },
          order: { recordedAt: 'DESC' },
        });

        const attempts = await this.attemptRepository.find({
          where: { participationId: participation.participationId },
          order: { attemptNumber: 'ASC' },
        });

        return {
          ...participation,
          results,
          attempts,
        };
      }),
    );

    return {
      ...match,
      participations: participationsWithResults,
    };
  }

  // ==================== MATCH RESULTS TIME VIEW ====================

  async recalculateSwimmingPositions(eventCategoryId: number) {
    // Obtener todos los resultados con tiempo registrado
    const results = await this.resultRepository
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.participation', 'participation')
      .leftJoinAndSelect('participation.registration', 'registration')
      .where('registration.eventCategoryId = :eventCategoryId', {
        eventCategoryId,
      })
      .andWhere('result.timeValue IS NOT NULL')
      .andWhere("(result.notes IS NULL OR result.notes NOT LIKE '%DQ%')")
      .orderBy('result.timeValue', 'ASC')
      .getMany();

    // Asignar posiciones
    for (let i = 0; i < results.length; i++) {
      results[i].rankPosition = i + 1;
      results[i].isWinner = i === 0; // El primero es el ganador
      await this.resultRepository.save(results[i]);
    }

    // Obtener descalificados y asignarles null
    const disqualified = await this.resultRepository
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.participation', 'participation')
      .leftJoinAndSelect('participation.registration', 'registration')
      .where('registration.eventCategoryId = :eventCategoryId', {
        eventCategoryId,
      })
      .andWhere('result.timeValue IS NOT NULL')
      .andWhere("result.notes LIKE '%DQ%'")
      .getMany();

    for (const result of disqualified) {
      result.rankPosition = null;
      result.isWinner = false;
      await this.resultRepository.save(result);
    }

    return {
      message: 'Posiciones recalculadas exitosamente',
      totalResults: results.length,
      disqualified: disqualified.length,
    };
  }

  async createTimeResult(dto: CreateTimeResultDto, userId: number) {
    // 1. Buscar o crear la participation para esta registration
    let participation = await this.participationRepository.findOne({
      where: { registrationId: dto.registrationId },
      relations: ['registration', 'registration.athlete', 'registration.team'],
    });

    if (!participation) {
      const newParticipation = this.participationRepository.create({
        registrationId: dto.registrationId,
        matchId: null,
        corner: null,
      });
      const saved = await this.participationRepository.save(newParticipation);

      participation = await this.participationRepository.findOne({
        where: { participationId: saved.participationId },
        relations: ['registration', 'registration.athlete', 'registration.team'],
      });

      if (!participation) {
        throw new NotFoundException(
          `No se pudo crear la participación para registration ${dto.registrationId}`,
        );
      }
    }

    // 2. Detectar si está descalificado
    const isDQ = dto.timeValue.startsWith('x');
    const cleanTime = isDQ ? dto.timeValue.substring(1) : dto.timeValue;

    // 3. Buscar si ya existe resultado para esta participation EN ESTA FASE
    //    (si viene phaseId, buscar por participation + phase;
    //     si no viene, buscar solo por participation — compatibilidad hacia atrás)
    let result: Result | null = null;

    if (dto.phaseId) {
      result = await this.resultRepository.findOne({
        where: {
          participationId: participation.participationId,
          phaseId: dto.phaseId,
        },
      });
    } else {
      result = await this.resultRepository.findOne({
        where: { participationId: participation.participationId },
      });
    }

    if (result) {
      // Actualizar resultado existente
      result.timeValue = cleanTime;
      result.notes = isDQ
        ? `DQ - ${dto.notes || 'Descalificado'}`
        : dto.notes || null;
      result.recordedBy = userId;
      if (dto.phaseId) result.phaseId = dto.phaseId; 
    } else {
      // Crear nuevo resultado
      result = this.resultRepository.create({
        participationId: participation.participationId,
        phaseId: dto.phaseId || null, 
        timeValue: cleanTime,
        notes: isDQ
          ? `DQ - ${dto.notes || 'Descalificado'}`
          : dto.notes || null,
        recordedBy: userId,
        rankPosition: null,
        isWinner: false,
      });
    }

    const savedResult = await this.resultRepository.save(result);

    // 4. Recalcular posiciones
    const eventCategoryId = participation.registration.eventCategoryId;

    // Si tiene phaseId, recalcular por fase; si no, recalcular por categoría entera
    if (dto.phaseId) {
      await this.recalculatePhaseTimePositions(dto.phaseId);
    } else {
      await this.recalculateSwimmingPositions(eventCategoryId);
    }

    return savedResult;
  }

  // recalcular posiciones dentro de una fase
  async recalculatePhaseTimePositions(phaseId: number) {
    const results = await this.resultRepository
      .createQueryBuilder('result')
      .where('result.phaseId = :phaseId', { phaseId })
      .andWhere('result.timeValue IS NOT NULL')
      .andWhere("(result.notes IS NULL OR result.notes NOT LIKE '%DQ%')")
      .orderBy('result.timeValue', 'ASC')
      .getMany();

    for (let i = 0; i < results.length; i++) {
      results[i].rankPosition = i + 1;
      results[i].isWinner = i === 0;
      await this.resultRepository.save(results[i]);
    }

    // DQ → rankPosition null
    const disqualified = await this.resultRepository
      .createQueryBuilder('result')
      .where('result.phaseId = :phaseId', { phaseId })
      .andWhere('result.timeValue IS NOT NULL')
      .andWhere("result.notes LIKE '%DQ%'")
      .getMany();

    for (const r of disqualified) {
      r.rankPosition = null;
      r.isWinner = false;
      await this.resultRepository.save(r);
    }

    return {
      message: 'Posiciones recalculadas por fase',
      totalResults: results.length,
      disqualified: disqualified.length,
    };
  }

  // obtener resultados por fase (para Natación/Atletismo)
  async getPhaseResults(phaseId: number) {
    const results = await this.resultRepository
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.participation', 'participation')
      .leftJoinAndSelect('participation.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .leftJoinAndSelect('team.members', 'members')
      .leftJoinAndSelect('members.athlete', 'memberAthlete')
      .where('result.phaseId = :phaseId', { phaseId })
      .andWhere('result.timeValue IS NOT NULL')
      .orderBy(
        'CASE WHEN result.rankPosition IS NULL THEN 1 ELSE 0 END',
        'ASC',
      )
      .addOrderBy('result.rankPosition', 'ASC')
      .addOrderBy('result.timeValue', 'ASC')
      .getMany();

    return results;
  }


  /**
   * Obtener resultados de natación por categoría
   */
  async getSwimmingResults(eventCategoryId: number) {
    const results = await this.resultRepository
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.participation', 'participation')
      .leftJoinAndSelect('participation.registration', 'registration')
      .leftJoinAndSelect('registration.athlete', 'athlete')
      .leftJoinAndSelect('athlete.institution', 'athleteInstitution')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('team.institution', 'teamInstitution')
      .leftJoinAndSelect('team.members', 'members')
      .leftJoinAndSelect('members.athlete', 'memberAthlete')
      .leftJoinAndSelect('registration.eventCategory', 'eventCategory')
      .where('eventCategory.eventCategoryId = :eventCategoryId', {
        eventCategoryId,
      })
      .andWhere('result.timeValue IS NOT NULL')
      .orderBy('CASE WHEN result.rankPosition IS NULL THEN 1 ELSE 0 END', 'ASC')
      .addOrderBy('result.rankPosition', 'ASC')
      .addOrderBy('result.timeValue', 'ASC')
      .getMany();

    return results;
  }

  /**
   * Actualizar un resultado de tiempo
   */
  async updateTimeResult(
    resultId: number,
    dto: Partial<CreateTimeResultDto>,
    userId: number,
  ) {
    const result = await this.resultRepository.findOne({
      where: { resultId },
    });

    if (!result) {
      throw new NotFoundException(`Resultado con ID ${resultId} no encontrado`);
    }

    // Si se actualiza el tiempo, procesar descalificación
    if (dto.timeValue) {
      const isDQ = dto.timeValue.startsWith('x');
      result.timeValue = isDQ ? dto.timeValue.substring(1) : dto.timeValue;
      if (isDQ && !result.notes?.includes('DQ')) {
        result.notes = `DQ - ${dto.notes || 'Descalificado'}`;
      }
    }

    if (dto.rankPosition !== undefined) {
      result.rankPosition = dto.rankPosition;
      result.isWinner = dto.rankPosition === 1;
    }

    if (dto.notes !== undefined) {
      result.notes = dto.notes;
    }

    result.recordedBy = userId;

    return await this.resultRepository.save(result);
  }

  /**
   * Eliminar un resultado
   */
  async deleteTimeResult(resultId: number) {
    const result = await this.resultRepository.findOne({
      where: { resultId },
    });

    if (!result) {
      throw new NotFoundException(`Resultado con ID ${resultId} no encontrado`);
    }

    await this.resultRepository.remove(result);
    return { message: 'Resultado eliminado correctamente' };
  }
}
