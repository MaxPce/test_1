import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndividualScore } from './entities/individual-score.entity';
import { Participation } from './entities/participation.entity';
import { Phase } from './entities/phase.entity';
import { Match } from './entities/match.entity';
import { BracketService } from './bracket.service';
import { MatchStatus, PhaseType } from '../common/enums';
import { UpdateTaoluScoreDto } from './dto/update-taolu-score.dto';
import { UpdateTaoluBracketScoreDto } from './dto/update-taolu-bracket-score.dto';

@Injectable()
export class WushuTaoluService {
  constructor(
    @InjectRepository(IndividualScore)
    private readonly individualScoreRepository: Repository<IndividualScore>,
    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,
    @InjectRepository(Phase)
    private readonly phaseRepository: Repository<Phase>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    private readonly bracketService: BracketService,
  ) {}

  // ==================== MODO GRUPOS (EXISTENTE) ====================

  

  async updatePoomsaeScore(
    participationId: number,
    updateDto: UpdateTaoluScoreDto,
  ): Promise<IndividualScore> {
    const participation = await this.participationRepository.findOne({
      where: { participationId },
    });

    if (!participation) {
      throw new NotFoundException(
        `Participation ${participationId} no encontrada`,
      );
    }

    if (!participation.matchId) {
      throw new NotFoundException(
        `Participation ${participationId} no tiene match asignado`,
      );
    }

    let score = await this.individualScoreRepository.findOne({
      where: { participationId },
    });

    // ── Cálculo de promedios ──
    const bValues = [updateDto.b1, updateDto.b2, updateDto.b3].filter(
      (v): v is number => v !== null && v !== undefined,
    );
    const aValues = [updateDto.a1, updateDto.a2].filter(
      (v): v is number => v !== null && v !== undefined,
    );

    const promB =
      bValues.length > 0
        ? bValues.reduce((sum, v) => sum + v, 0) / bValues.length
        : 0;

    const promA =
      aValues.length > 0
        ? aValues.reduce((sum, v) => sum + v, 0) / aValues.length
        : 0;

    const puntajeActual = promB + promA;

    const minus = updateDto.juezPrincipalMinus ?? 0;
    const plus  = updateDto.juezPrincipalPlus  ?? 0;
    const total = parseFloat((puntajeActual - minus + plus).toFixed(2));

    const fields = {
      b1: updateDto.b1 ?? null,
      b2: updateDto.b2 ?? null,
      b3: updateDto.b3 ?? null,
      a1: updateDto.a1 ?? null,
      a2: updateDto.a2 ?? null,
      juezPrincipalMinus: minus,
      juezPrincipalPlus:  plus,
      // accuracy reutiliza promB, presentation reutiliza promA
      // para no romper compatibilidad con modo bracket existente
      accuracy:     parseFloat(promB.toFixed(2)),
      presentation: parseFloat(promA.toFixed(2)),
      total,
    };

    if (score) {
      Object.assign(score, fields);
    } else {
      score = this.individualScoreRepository.create({
        participationId,
        ...fields,
      });
    }

    await this.individualScoreRepository.save(score);
    await this.recalculateRankings(participation.matchId);

    return score;
  }

  async initializeGroupPhase(
    phaseId: number,
    registrationIds: number[],
  ): Promise<{ matchId: number; participationsCreated: number }> {
    const phase = await this.phaseRepository.findOne({ where: { phaseId } });

    if (!phase) {
      throw new NotFoundException(`Phase ${phaseId} no encontrada`);
    }

    // Limpiar matches/participaciones previas si existen
    const existingMatches = await this.matchRepository.find({ where: { phaseId } });
    for (const match of existingMatches) {
      await this.participationRepository.delete({ matchId: match.matchId });
    }
    if (existingMatches.length > 0) {
      await this.matchRepository.delete({ phaseId });
    }

    // Crear 1 match "contenedor" que agrupa todas las participaciones
    const groupMatch: Match = this.matchRepository.create({
      phaseId,
      matchNumber: 1,
      round: 'grupo',           // ← string, no number
      status: MatchStatus.PROGRAMADO,
    });
    const savedMatch: Match = await this.matchRepository.save(groupMatch);

    // Crear una participación por cada registrationId
    for (let i = 0; i < registrationIds.length; i++) {
      const participation: Participation = this.participationRepository.create({
        matchId: savedMatch.matchId,
        registrationId: registrationIds[i],
        corner: null,           // ← Corner | null, no un número
      });
      await this.participationRepository.save(participation);
    }

    return {
      matchId: savedMatch.matchId,
      participationsCreated: registrationIds.length,
    };
  }

  // ── NUEVO: Generar múltiples fases Taolu desde el modal ──────────────────────

  async generateTaoluPhases(dto: {
    eventCategoryId: number;
    groups: { name: string; registrationIds: number[] }[];
  }): Promise<{ phasesCreated: number }> {
    for (const group of dto.groups) {
      // 1. Crear la fase tipo grupo usando el enum correcto
      const phase: Phase = this.phaseRepository.create({
        eventCategoryId: dto.eventCategoryId,
        name: group.name,
        type: PhaseType.GRUPO,  // ← enum, no string literal
      });
      const savedPhase: Phase = await this.phaseRepository.save(phase);

      // 2. Crear match contenedor + participaciones
      await this.initializeGroupPhase(savedPhase.phaseId, group.registrationIds);
    }

    return { phasesCreated: dto.groups.length };
  }


  // ==================== MODO BRACKET (NUEVO) ====================

  /**
   * Actualiza el score de un participante en modo bracket y determina automáticamente el ganador
   */
  async updatePoomsaeBracketScore(
    participationId: number,
    updateDto: UpdateTaoluBracketScoreDto,
  ): Promise<{
    score: IndividualScore;
    matchFinalized: boolean;
    winner?: {
      participationId: number;
      registrationId: number;
      total: number;
    };
    advancedToNextRound: boolean;
    message: string;
  }> {
    // 1. Validar participación
    const participation = await this.participationRepository.findOne({
      where: { participationId },
      relations: ['match', 'match.participations', 'registration'],
    });

    if (!participation) {
      throw new NotFoundException(
        `Participation ${participationId} no encontrada`,
      );
    }

    if (!participation.matchId) {
      throw new NotFoundException(
        `Participation ${participationId} no tiene match asignado`,
      );
    }

    const match = participation.match;

    // 2. Validar que el match esté en estado válido para actualizar scores
    if (match.status === MatchStatus.FINALIZADO) {
      throw new BadRequestException(
        'No se puede actualizar el score de un match ya finalizado',
      );
    }

    // 3. Actualizar o crear el score del participante actual
    let score = await this.individualScoreRepository.findOne({
      where: { participationId },
    });

    const total = updateDto.accuracy + updateDto.presentation;

    if (score) {
      score.accuracy = updateDto.accuracy;
      score.presentation = updateDto.presentation;
      score.total = total;
    } else {
      score = this.individualScoreRepository.create({
        participationId,
        accuracy: updateDto.accuracy,
        presentation: updateDto.presentation,
        total,
      });
    }

    await this.individualScoreRepository.save(score);

    // 4. Verificar si ya hay 2 participantes en el match
    const participations = match.participations;

    if (participations.length !== 2) {
      // Solo hay 1 participante, no se puede determinar ganador aún
      return {
        score,
        matchFinalized: false,
        advancedToNextRound: false,
        message: 'Score actualizado. Esperando al segundo competidor.',
      };
    }

    // 5. Obtener los scores de ambos participantes
    const allScores = await this.individualScoreRepository.find({
      where: participations.map((p) => ({
        participationId: p.participationId,
      })),
    });

    // 6. Verificar si ambos competidores ya tienen scores completos
    if (allScores.length < 2) {
      return {
        score,
        matchFinalized: false,
        advancedToNextRound: false,
        message: 'Score actualizado. Esperando score del oponente.',
      };
    }

    // Verificar que ambos scores tengan totales válidos
    const validScores = allScores.filter(
      (s) => s.total !== null && s.total !== undefined && s.total > 0,
    );

    if (validScores.length < 2) {
      return {
        score,
        matchFinalized: false,
        advancedToNextRound: false,
        message: 'Score actualizado. Esperando score completo del oponente.',
      };
    }

    // 7. DETERMINAR EL GANADOR AUTOMÁTICAMENTE
    const [score1, score2] = allScores;

    let winnerScore: IndividualScore;
    let winnerParticipation: Participation | undefined;

    if (score1.total > score2.total) {
      winnerScore = score1;
      winnerParticipation = participations.find(
        (p) => p.participationId === score1.participationId,
      );
    } else if (score2.total > score1.total) {
      winnerScore = score2;
      winnerParticipation = participations.find(
        (p) => p.participationId === score2.participationId,
      );
    } else {
      // Esto no debería ocurrir según las reglas, pero por seguridad
      throw new BadRequestException(
        'Empate detectado. Esto no debería ser posible según las reglas de Poomsae.',
      );
    }

    if (!winnerParticipation) {
      throw new NotFoundException(
        'No se pudo determinar el participante ganador',
      );
    }

    if (!winnerParticipation.registrationId) {
      throw new BadRequestException(
        'El participante ganador no tiene registrationId',
      );
    }

    // 8. Actualizar el match con participant1_score y participant2_score (y detalles)
    const participant1 = participations[0];
    const participant2 = participations[1];

    const participant1Score = allScores.find(
      (s) => s.participationId === participant1.participationId,
    );
    const participant2Score = allScores.find(
      (s) => s.participationId === participant2.participationId,
    );

    // Guardar totales
    match.participant1Score = participant1Score?.total || 0;
    match.participant2Score = participant2Score?.total || 0;

    // Guardar detalles de accuracy y presentation
    match.participant1Accuracy = participant1Score?.accuracy || 0;
    match.participant1Presentation = participant1Score?.presentation || 0;
    match.participant2Accuracy = participant2Score?.accuracy || 0;
    match.participant2Presentation = participant2Score?.presentation || 0;

    await this.matchRepository.save(match);

    // 9. Avanzar automáticamente al ganador usando BracketService
    const advanceResult = await this.bracketService.advanceWinner({
      matchId: match.matchId,
      winnerRegistrationId: winnerParticipation.registrationId,
      participant1Score: match.participant1Score,
      participant2Score: match.participant2Score,
    });

    // 10. Retornar resultado completo
    return {
      score,
      matchFinalized: true,
      winner: {
        participationId: winnerParticipation.participationId,
        registrationId: winnerParticipation.registrationId,
        total: winnerScore.total,
      },
      advancedToNextRound: !!advanceResult.nextMatch,
      message: advanceResult.message,
    };
  }

  /**
   * Obtiene los scores de un match específico en modo bracket
   */
  async getBracketMatchScores(matchId: number): Promise<any> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: [
        'participations',
        'participations.registration',
        'participations.registration.athlete',
        'participations.registration.athlete.institution',
        'participations.registration.team',
        'participations.registration.team.institution',
      ],
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    const participations = match.participations;

    if (!participations || participations.length === 0) {
      return {
        matchId,
        participants: [],
        status: match.status,
        winner: null,
      };
    }

    // Obtener scores
    const scores = await this.individualScoreRepository.find({
      where: participations.map((p) => ({
        participationId: p.participationId,
      })),
    });

    const participants = participations.map((participation) => {
      const score = scores.find(
        (s) => s.participationId === participation.participationId,
      );

      const reg = participation.registration;
      const isTeam = !!reg?.team;

      const name = isTeam ? reg.team.name : reg?.athlete?.name || 'Sin nombre';

      const photoUrl = isTeam ? null : reg?.athlete?.photoUrl || null;

      const institution = isTeam
        ? reg.team.institution
        : reg?.athlete?.institution;

      return {
        participationId: participation.participationId,
        registrationId: participation.registrationId,
        corner: participation.corner,
        participantName: name,
        isTeam: isTeam,
        participantPhoto: photoUrl,
        institution: institution?.name || 'Sin institución',
        institutionLogo: institution?.logoUrl || null,
        accuracy: score?.accuracy || null,
        presentation: score?.presentation || null,
        total: score?.total || null,
        isWinner: match.winnerRegistrationId === participation.registrationId,
      };
    });

    return {
      matchId,
      matchNumber: match.matchNumber,
      round: match.round,
      status: match.status,
      participants,
      winner: match.winnerRegistrationId
        ? participants.find(
            (p) => p.registrationId === match.winnerRegistrationId,
          )
        : null,
    };
  }

  // ==================== MÉTODOS COMUNES ====================

  async getPhaseScores(phaseId: number) {
    const phase = await this.phaseRepository.findOne({
      where: { phaseId },
      relations: [
        'matches',
        'matches.participations',
        'matches.participations.registration',
        'matches.participations.registration.athlete',
        'matches.participations.registration.athlete.institution',
        'matches.participations.registration.team',
        'matches.participations.registration.team.institution',
      ],
    });

    if (!phase) {
      throw new NotFoundException(`Phase ${phaseId} no encontrada`);
    }

    // Obtener participaciones
    const participations = phase.matches
      .flatMap((match) => match.participations || [])
      .filter((p) => p !== null)
      // Filtrar participations con registrations eliminados
      .filter((p) => {
        // Si no tiene registration, filtrar
        if (!p.registration) return false;

        // Si el registration tiene deletedAt, filtrar
        if (p.registration.deletedAt) return false;

        // Si tiene athlete, verificar que no esté eliminado
        if (p.registration.athlete && p.registration.athlete.deletedAt) {
          return false;
        }

        // Si tiene team, verificar que no esté eliminado
        if (p.registration.team && p.registration.team.deletedAt) {
          return false;
        }

        return true;
      });

    if (participations.length === 0) {
      return []; // No hay participantes
    }

    const scores = await this.individualScoreRepository.find({
      where: participations.map((p) => ({
        participationId: p.participationId,
      })),
    });

    const results = participations.map((participation) => {
      const score = scores.find(
        (s) => s.participationId === participation.participationId,
      );

      const reg = participation.registration;
      const isTeam = !!reg?.team;

      const name = isTeam ? reg.team.name : reg?.athlete?.name || 'Sin nombre';

      const photoUrl = isTeam ? null : reg?.athlete?.photoUrl || null;

      const institution = isTeam
        ? reg.team.institution
        : reg?.athlete?.institution;

      const gender = isTeam ? 'Equipo' : reg?.athlete?.gender || '-';

      return {
        participationId: participation.participationId,
        participantName: name,
        isTeam: isTeam,
        participantPhoto: photoUrl,
        institution: institution?.name || 'Sin institución',
        institutionLogo: institution?.logoUrl || null,
        gender: gender,
        accuracy:     score?.accuracy     ?? null,
        presentation: score?.presentation ?? null,
        total:        score?.total        ?? null,
        rank:         score?.rank         ?? null,
        // ── campos Taolu jueces B/A ──
        b1:                   score?.b1                   ?? null,
        b2:                   score?.b2                   ?? null,
        b3:                   score?.b3                   ?? null,
        a1:                   score?.a1                   ?? null,
        a2:                   score?.a2                   ?? null,
        juezPrincipalMinus:   score?.juezPrincipalMinus   ?? null,
        juezPrincipalPlus:    score?.juezPrincipalPlus    ?? null,
      };
    });

    return results;
  }

  async getParticipationScore(
    participationId: number,
  ): Promise<IndividualScore> {
    const score = await this.individualScoreRepository.findOne({
      where: { participationId },
    });

    if (!score) {
      throw new NotFoundException(
        `Score para participación ${participationId} no encontrado`,
      );
    }

    return score;
  }

  private async recalculateRankings(matchId: number): Promise<void> {
    const participation = await this.participationRepository.findOne({
      where: { matchId },
      relations: ['match'],
    });

    if (!participation || !participation.match) return;

    const phaseId = participation.match.phaseId;

    const participationsWithScores = await this.participationRepository.find({
      where: { match: { phaseId } },
      relations: ['match'],
    });

    const participationIds = participationsWithScores.map(
      (p) => p.participationId,
    );

    const scores = await this.individualScoreRepository.find({
      where: participationIds.map((id) => ({ participationId: id })),
    });

    const sorted = scores
      .filter((score) => score.total && score.total > 0)
      .sort((a, b) => b.total - a.total);

    for (let i = 0; i < sorted.length; i++) {
      await this.individualScoreRepository.update(sorted[i].scoreId, {
        rank: i + 1,
      });
    }
  }
}
