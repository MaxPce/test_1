import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Match, Participation } from './entities';
import { GenerateBracketDto, AdvanceWinnerDto } from './dto';
import { MatchStatus, Corner } from '../common/enums';

@Injectable()
export class BracketService {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Participation)
    private participationRepository: Repository<Participation>,
    private dataSource: DataSource,
  ) {}

  // ==================== GENERACIÓN DE BRACKET COMPLETO ====================

  /**
   * Genera un bracket completo de eliminación usando solo matchNumber para las conexiones
   */
  async generateCompleteBracket(dto: GenerateBracketDto): Promise<{
    mainBracket: Match[];
    thirdPlaceMatch: Match | null;
    bracketInfo: any;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const registrations = dto.registrationIds;
      const numParticipants = registrations.length;

      if (numParticipants < 2) {
        throw new BadRequestException('Se necesitan al menos 2 participantes');
      }

      // Calcular estructura del bracket
      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
      const totalRounds = Math.log2(nextPowerOf2);

      const mainBracket: Match[] = [];
      let currentMatchNumber = 1;

      // Generar todas las rondas
      for (let round = 0; round < totalRounds; round++) {
        const matchesInRound = nextPowerOf2 / Math.pow(2, round + 1);
        const roundName = this.getRoundName(matchesInRound);

        for (let i = 0; i < matchesInRound; i++) {
          const match = queryRunner.manager.create(Match, {
            phaseId: dto.phaseId,
            matchNumber: currentMatchNumber,
            round: roundName,
            status: MatchStatus.PROGRAMADO,
          });

          const savedMatch = await queryRunner.manager.save(match);
          mainBracket.push(savedMatch);

          // Solo asignar participantes en la PRIMERA ronda
          if (round === 0) {
            await this.assignFirstRoundParticipants(
              queryRunner,
              savedMatch,
              registrations,
              i,
              mainBracket,
            );
          }

          currentMatchNumber++;
        }
      }

      // Generar match de tercer lugar si está habilitado
      let thirdPlaceMatch: Match | null = null;

      if (dto.includeThirdPlace) {
        thirdPlaceMatch = queryRunner.manager.create(Match, {
          phaseId: dto.phaseId,
          matchNumber: 9999, // Número especial para tercer lugar
          round: 'tercer_lugar',
          status: MatchStatus.PROGRAMADO,
        });

        thirdPlaceMatch = await queryRunner.manager.save(thirdPlaceMatch);
      }

      await queryRunner.commitTransaction();

      // Calcular información del bracket
      const bracketInfo = {
        totalParticipants: numParticipants,
        totalSlots: nextPowerOf2,
        totalRounds: totalRounds,
        hasThirdPlace: dto.includeThirdPlace,
        byeCount: nextPowerOf2 - numParticipants,
      };

      return {
        mainBracket,
        thirdPlaceMatch,
        bracketInfo,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Asigna participantes a la primera ronda y maneja BYEs
   */
  private async assignFirstRoundParticipants(
    queryRunner: any,
    match: Match,
    registrations: number[],
    matchIndex: number,
    allMatches: Match[],
  ): Promise<void> {
    const participant1Index = matchIndex * 2;
    const participant2Index = matchIndex * 2 + 1;

    // Participante 1
    if (participant1Index < registrations.length) {
      await queryRunner.manager.save(Participation, {
        matchId: match.matchId,
        registrationId: registrations[participant1Index],
        corner: Corner.BLUE,
      });
    }

    // Participante 2
    if (participant2Index < registrations.length) {
      await queryRunner.manager.save(Participation, {
        matchId: match.matchId,
        registrationId: registrations[participant2Index],
        corner: Corner.WHITE,
      });
    }

    // BYE automático: si solo hay un participante, avanza directo
    if (
      participant1Index < registrations.length &&
      participant2Index >= registrations.length
    ) {
      match.winnerRegistrationId = registrations[participant1Index];
      match.status = MatchStatus.FINALIZADO;
      await queryRunner.manager.save(match);

      // Avanzar automáticamente a la siguiente ronda
      await this.autoAdvanceWinner(
        queryRunner,
        match,
        registrations[participant1Index],
        allMatches,
      );
    }
  }

  // ==================== AVANCE DE GANADORES ====================

  /**
   * Avanza el ganador de un match automáticamente
   */
  async advanceWinner(dto: AdvanceWinnerDto): Promise<{
    updatedMatch: Match;
    nextMatch?: Match;
    thirdPlaceMatch?: Match;
    message: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const match = await this.matchRepository.findOne({
        where: { matchId: dto.matchId },
        relations: ['participations', 'participations.registration', 'phase'],
      });

      if (!match) {
        throw new NotFoundException('Match no encontrado');
      }

      // Validar que el ganador participa en el match
      const winnerParticipation = match.participations.find(
        (p) => p.registrationId === dto.winnerRegistrationId,
      );

      if (!winnerParticipation) {
        throw new BadRequestException(
          'El ganador especificado no participa en este match',
        );
      }

      // Actualizar el match actual
      match.winnerRegistrationId = dto.winnerRegistrationId;
      match.status = MatchStatus.FINALIZADO;

      if (dto.participant1Score !== undefined) {
        match.participant1Score = dto.participant1Score;
      }
      if (dto.participant2Score !== undefined) {
        match.participant2Score = dto.participant2Score;
      }

      await queryRunner.manager.save(match);

      // Obtener todos los matches de la fase para calcular conexiones
      const allMatches = await queryRunner.manager.find(Match, {
        where: { phaseId: match.phaseId },
        order: { matchNumber: 'ASC' },
      });

      let nextMatch: Match | null = null;

      let thirdPlaceMatch: Match | null = null;

      let message = 'Match finalizado correctamente';

      // Calcular el siguiente match
      const nextMatchNumber = this.calculateNextMatchNumber(
        match.matchNumber,
        match.round,
        allMatches,
      );

      if (nextMatchNumber) {
        nextMatch = await this.advanceToNextMatch(
          queryRunner,
          match,
          dto.winnerRegistrationId,
          nextMatchNumber,
        );

        if (nextMatch) {
          message = `Ganador avanzado automáticamente a ${nextMatch.round}`;
        }
      } else {
        // Es la final
        if (match.round === 'final') {
          message = `¡Campeón definido! Registration ID: ${dto.winnerRegistrationId}`;
        }
      }

      // Si es semifinal, manejar tercer lugar
      if (match.round === 'semifinal') {
        thirdPlaceMatch = await this.handleThirdPlaceMatch(
          queryRunner,
          match,
          dto.winnerRegistrationId,
        );
      }

      await queryRunner.commitTransaction();

      return {
        updatedMatch: match,
        nextMatch: nextMatch ?? undefined,
        thirdPlaceMatch: thirdPlaceMatch ?? undefined,
        message,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Avanza un ganador al siguiente match
   */
  private async advanceToNextMatch(
    queryRunner: any,
    currentMatch: Match,
    winnerId: number,
    nextMatchNumber: number,
  ): Promise<Match | null> {
    const nextMatch = await queryRunner.manager.findOne(Match, {
      where: {
        phaseId: currentMatch.phaseId,
        matchNumber: nextMatchNumber,
      },
      relations: ['participations'],
    });

    if (!nextMatch) return null;

    // Verificar si ya está participando
    const existingParticipation = nextMatch.participations.find(
      (p) => p.registrationId === winnerId,
    );

    if (!existingParticipation) {
      // Determinar corner basado en cuántos participantes hay
      const corner =
        nextMatch.participations.length === 0 ? Corner.BLUE : Corner.WHITE;

      await queryRunner.manager.save(Participation, {
        matchId: nextMatch.matchId,
        registrationId: winnerId,
        corner,
      });
    }

    return nextMatch;
  }

  /**
   * Avanza automáticamente un ganador (usado para BYEs)
   */
  private async autoAdvanceWinner(
    queryRunner: any,
    match: Match,
    winnerId: number,
    allMatches: Match[],
  ): Promise<void> {
    const nextMatchNumber = this.calculateNextMatchNumber(
      match.matchNumber,
      match.round,
      allMatches,
    );

    if (!nextMatchNumber) return;

    const nextMatch = allMatches.find((m) => m.matchNumber === nextMatchNumber);
    if (!nextMatch) return;

    // Crear participación en el siguiente match
    await queryRunner.manager.save(Participation, {
      matchId: nextMatch.matchId,
      registrationId: winnerId,
      corner: Corner.BLUE,
    });
  }

  // ==================== TERCER LUGAR ====================

  /**
   * Maneja la adición de perdedores al match de tercer lugar
   */
  private async handleThirdPlaceMatch(
    queryRunner: any,
    semifinalMatch: Match,
    winnerId: number,
  ): Promise<Match | null> {
    // Buscar el match de tercer lugar
    const thirdPlaceMatch = await queryRunner.manager.findOne(Match, {
      where: {
        phaseId: semifinalMatch.phaseId,
        round: 'tercer_lugar',
      },
      relations: ['participations'],
    });

    if (!thirdPlaceMatch) return null;

    // Encontrar al perdedor
    const loserParticipation = semifinalMatch.participations.find(
      (p) => p.registrationId !== winnerId,
    );

    if (!loserParticipation) return null;

    // Verificar si ya está participando
    const existingParticipation = thirdPlaceMatch.participations.find(
      (p) => p.registrationId === loserParticipation.registrationId,
    );

    if (!existingParticipation) {
      const corner =
        thirdPlaceMatch.participations.length === 0
          ? Corner.BLUE
          : Corner.WHITE;

      await queryRunner.manager.save(Participation, {
        matchId: thirdPlaceMatch.matchId,
        registrationId: loserParticipation.registrationId,
        corner,
      });
    }

    return thirdPlaceMatch;
  }

  // ==================== CÁLCULOS Y UTILIDADES ====================

  /**
   * Calcula qué match sigue basándose en matchNumber y round
   */
  private calculateNextMatchNumber(
    currentMatchNumber: number,
    currentRound: string,
    allMatches: Match[],
  ): number | null {
    // Agrupar matches por ronda
    const matchesByRound = this.groupMatchesByRound(allMatches);

    // Encontrar la ronda actual
    const currentRoundMatches = matchesByRound[currentRound];
    if (!currentRoundMatches) return null;

    // Encontrar posición en la ronda actual
    const positionInRound = currentRoundMatches.findIndex(
      (m) => m.matchNumber === currentMatchNumber,
    );

    if (positionInRound === -1) return null;

    // Calcular ronda siguiente
    const nextRoundName = this.getNextRoundName(currentRound);
    if (!nextRoundName) return null; // Es la final

    const nextRoundMatches = matchesByRound[nextRoundName];
    if (!nextRoundMatches) return null;

    // El ganador del match par 0,1 va al match 0 de la siguiente ronda
    // El ganador del match par 2,3 va al match 1 de la siguiente ronda
    const nextMatchIndex = Math.floor(positionInRound / 2);

    return nextRoundMatches[nextMatchIndex]?.matchNumber || null;
  }

  /**
   * Agrupa matches por ronda para facilitar cálculos
   */
  private groupMatchesByRound(matches: Match[]): Record<string, Match[]> {
    const grouped: Record<string, Match[]> = {};

    for (const match of matches) {
      if (!grouped[match.round]) {
        grouped[match.round] = [];
      }
      grouped[match.round].push(match);
    }

    // Ordenar cada grupo por matchNumber
    for (const round in grouped) {
      grouped[round].sort((a, b) => a.matchNumber - b.matchNumber);
    }

    return grouped;
  }

  /**
   * Obtiene el nombre de la siguiente ronda
   */
  private getNextRoundName(currentRound: string): string | null {
    const roundOrder = [
      'dieciseisavos',
      'octavos',
      'cuartos',
      'semifinal',
      'final',
    ];

    const currentIndex = roundOrder.indexOf(currentRound);
    if (currentIndex === -1 || currentIndex === roundOrder.length - 1) {
      return null; // No hay siguiente ronda o es la final
    }

    return roundOrder[currentIndex + 1];
  }

  /**
   * Obtiene el nombre de la ronda basado en número de matches
   */
  private getRoundName(numMatches: number): string {
    const rounds: { [key: number]: string } = {
      1: 'final',
      2: 'semifinal',
      4: 'cuartos',
      8: 'octavos',
      16: 'dieciseisavos',
      32: 'treintaidosavos',
    };
    return rounds[numMatches] || `ronda_${numMatches}`;
  }

  // ==================== CONSULTAS ====================

  /**
   * Obtiene la estructura completa del bracket
   */
  async getBracketStructure(phaseId: number): Promise<any> {
    const matches = await this.matchRepository.find({
      where: { phaseId },
      relations: [
        'participations',
        'participations.registration',
        'participations.registration.athlete',
        'participations.registration.athlete.institution',
        'participations.registration.team',
        'participations.registration.team.institution',
        'winner',
        'winner.athlete',
        'winner.athlete.institution',
      ],
      order: {
        matchNumber: 'ASC',
      },
    });

    const grouped = this.groupMatchesByRound(matches);

    // Encontrar tercer lugar
    const thirdPlace = matches.find((m) => m.round === 'tercer_lugar');

    // Calcular estadísticas
    const stats = this.calculateBracketStats(matches);

    return {
      bracketByRound: grouped,
      thirdPlaceMatch: thirdPlace,
      totalMatches: matches.length,
      stats,
      matches: matches, // Para uso del frontend
    };
  }

  /**
   * Calcula estadísticas del bracket
   */
  private calculateBracketStats(matches: Match[]): any {
    const total = matches.length;
    const completed = matches.filter(
      (m) => m.status === MatchStatus.FINALIZADO,
    ).length;
    const inProgress = matches.filter(
      (m) => m.status === MatchStatus.EN_CURSO,
    ).length;
    const pending = matches.filter(
      (m) => m.status === MatchStatus.PROGRAMADO,
    ).length;

    return {
      total,
      completed,
      inProgress,
      pending,
      completionPercentage:
        total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Verifica si un bracket está completo (tiene campeón)
   */
  async isBracketComplete(phaseId: number): Promise<boolean> {
    const finalMatch = await this.matchRepository.findOne({
      where: {
        phaseId,
        round: 'final',
      },
    });

    return (
      finalMatch?.status === MatchStatus.FINALIZADO &&
      !!finalMatch.winnerRegistrationId
    );
  }

  /**
   * Obtiene el campeón del bracket
   */
  async getChampion(phaseId: number): Promise<any> {
    const finalMatch = await this.matchRepository.findOne({
      where: {
        phaseId,
        round: 'final',
        status: MatchStatus.FINALIZADO,
      },
      relations: [
        'winner',
        'winner.athlete',
        'winner.athlete.institution',
        'winner.team',
        'winner.team.institution',
      ],
    });

    if (!finalMatch || !finalMatch.winner) {
      return null;
    }

    return {
      registration: finalMatch.winner,
      matchId: finalMatch.matchId,
      finalizedAt: finalMatch.updatedAt,
    };
  }

  /**
   * Obtiene el tercer lugar
   */
  async getThirdPlace(phaseId: number): Promise<any> {
    const thirdPlaceMatch = await this.matchRepository.findOne({
      where: {
        phaseId,
        round: 'tercer_lugar',
        status: MatchStatus.FINALIZADO,
      },
      relations: [
        'winner',
        'winner.athlete',
        'winner.athlete.institution',
        'winner.team',
        'winner.team.institution',
      ],
    });

    if (!thirdPlaceMatch || !thirdPlaceMatch.winner) {
      return null;
    }

    return {
      registration: thirdPlaceMatch.winner,
      matchId: thirdPlaceMatch.matchId,
      finalizedAt: thirdPlaceMatch.updatedAt,
    };
  }
}
