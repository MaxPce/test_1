import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Match, Participation, PhaseRegistration, PhaseManualRank, Phase, Standing } from './entities';
import { GroupStanding } from './entities/group-standing.entity';
import { GenerateBracketDto, AdvanceWinnerDto, GroupDefinitionDto } from './dto';
import { MatchStatus, Corner, PhaseType } from '../common/enums';

@Injectable()
export class BracketService {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Participation)
    private participationRepository: Repository<Participation>,
    @InjectRepository(PhaseRegistration)                          
    private phaseRegistrationRepository: Repository<PhaseRegistration>,
    @InjectRepository(PhaseManualRank)              
    private phaseManualRankRepository: Repository<PhaseManualRank>,
    @InjectRepository(Phase)
    private phaseRepository: Repository<Phase>,
    @InjectRepository(GroupStanding)
    private groupStandingRepository: Repository<GroupStanding>,
    @InjectRepository(Standing)
    private readonly standingRepository: Repository<Standing>,
    private dataSource: DataSource,
  ) {}

  // ==================== GENERACIÓN DE BRACKET COMPLETO ====================

  /**
 * Genera un bracket completo de eliminación usando seeding
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
      const registrations = dto.registrationIds || [];
      const isEmptyBracket = !!dto.bracketSize;

      let numParticipants: number;

      if (isEmptyBracket) {
        if (!dto.bracketSize) {
          throw new BadRequestException(
            'Para bracket vacío, especifique bracketSize (8, 16, 32)',
          );
        }
        numParticipants = dto.bracketSize;
      } else {
        numParticipants = registrations.length;
        if (numParticipants < 2) {
          throw new BadRequestException(
            'Se necesitan al menos 2 participantes',
          );
        }
      }

      // Calcular bracket size (próxima potencia de 2)
      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
      const totalRounds = Math.log2(nextPowerOf2);
      const numByes = nextPowerOf2 - numParticipants;

      console.log(`📊 Bracket Info: ${numParticipants} participantes, ${nextPowerOf2} slots, ${numByes} BYEs`);

      // Obtener registrations con seed_number
      let seededRegistrations: Array<{ registrationId: number; seedNumber: number | null }> = [];
      
      if (!isEmptyBracket) {
        const registrationEntities = await queryRunner.manager
          .createQueryBuilder()
          .select(['registration.registrationId', 'registration.seedNumber'])
          .from('registrations', 'registration')
          .where('registration.registrationId IN (:...ids)', { ids: registrations })
          .getRawMany();

        // Ordenar por seed_number (nulls al final)
        seededRegistrations = registrationEntities
          .map((r) => ({
            registrationId: r.registration_registration_id,
            seedNumber: r.registration_seed_number,
          }))
          .sort((a, b) => {
            if (a.seedNumber === null) return 1;
            if (b.seedNumber === null) return -1;
            return a.seedNumber - b.seedNumber;
          });

        console.log('🎯 Seeded Registrations:', seededRegistrations);
      }

      // ── Guardar pool en phase_registrations ──────────────────────────────
      // SIEMPRE que vengan registrationIds los guardamos.
      // AssignParticipantsModal lee GET /phases/:id/registrations y filtra
      // su dropdown a solo estos participantes — tanto para bracket
      // "con participantes" como "vacío".
      if (registrations.length > 0) {
        const existingPhaseRegs = await queryRunner.manager.find(
          PhaseRegistration,
          { where: { phaseId: dto.phaseId } },
        );
        if (existingPhaseRegs.length > 0) {
          await queryRunner.manager.remove(PhaseRegistration, existingPhaseRegs);
        }

        const phaseRegs = registrations.map((registrationId) =>
          queryRunner.manager.create(PhaseRegistration, {
            phaseId: dto.phaseId,
            registrationId,
          }),
        );
        await queryRunner.manager.save(PhaseRegistration, phaseRegs);
      }

      const mainBracket: Match[] = [];
      let currentMatchNumber = 1;

      // Generar matches por ronda con distribución de seeding
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

          // Solo asignar participantes en la primera ronda
          if (round === 0 && !isEmptyBracket) {
            await this.assignFirstRoundParticipantsWithSeeding(
              queryRunner,
              savedMatch,
              seededRegistrations,
              i,
              nextPowerOf2,
              mainBracket,
            );
          }

          currentMatchNumber++;
        }
      }

      // Tercer lugar
      let thirdPlaceMatch: Match | null = null;

      if (dto.includeThirdPlace) {
        thirdPlaceMatch = queryRunner.manager.create(Match, {
          phaseId: dto.phaseId,
          matchNumber: currentMatchNumber,
          round: 'tercer_lugar',
          status: MatchStatus.PROGRAMADO,
        });

        thirdPlaceMatch = await queryRunner.manager.save(thirdPlaceMatch);
      }
      await queryRunner.commitTransaction();

      const bracketInfo = {
        totalParticipants: isEmptyBracket ? 0 : numParticipants,
        totalSlots: nextPowerOf2,
        totalRounds: totalRounds,
        hasThirdPlace: dto.includeThirdPlace,
        byeCount: isEmptyBracket ? 0 : numByes,
        isEmpty: isEmptyBracket,
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
 * Asigna participantes a la primera ronda usando seeding estándar de torneos
 * Distribución: Seed #1 y #2 van a lados opuestos del bracket
 */
  private async assignFirstRoundParticipantsWithSeeding(
    queryRunner: any,
    match: Match,
    seededRegistrations: Array<{ registrationId: number; seedNumber: number | null }>,
    matchIndex: number,
    bracketSize: number,
    allMatches: Match[],
  ): Promise<void> {
    // Distribución estándar de seeding con bracket de potencia de 2
    // Usa la fórmula: participant[i] enfrenta a participant[bracketSize - 1 - i]
    // Pero ajustado para que #1 y #2 queden en lados opuestos
    
    const numFirstRoundMatches = bracketSize / 2;
    
    // Mapeo de posiciones estándar de torneos
    // Esto asegura que los mejores seeds estén distribuidos correctamente
    const seedPairings = [
      [0, bracketSize - 1],  // Match 0: Seed #1 vs Seed #8 (o BYE)
      [numFirstRoundMatches - 1, numFirstRoundMatches],  // Match 1: Seed #4 vs Seed #5
      [numFirstRoundMatches - 2, numFirstRoundMatches + 1],  // Match 2: Seed #3 vs Seed #6
      [1, bracketSize - 2],  // Match 3: Seed #2 vs Seed #7 (o BYE)
    ];
    
    // Para brackets de 8, usar el pairing estándar
    let seed1Index: number;
    let seed2Index: number;
    
    if (bracketSize === 8 && matchIndex < 4) {
      [seed1Index, seed2Index] = seedPairings[matchIndex];
    } else {
      // Fallback para otros tamaños de bracket
      seed1Index = matchIndex;
      seed2Index = bracketSize - 1 - matchIndex;
    }
    
    const participant1 = seededRegistrations[seed1Index] || null;
    const participant2 = seededRegistrations[seed2Index] || null;
    
    // Participante 1 (seed bajo)
    if (participant1) {
      await queryRunner.manager.save(Participation, {
        matchId: match.matchId,
        registrationId: participant1.registrationId,
        corner: Corner.BLUE,
      });
    }

    // Participante 2 (seed alto)
    if (participant2) {
      await queryRunner.manager.save(Participation, {
        matchId: match.matchId,
        registrationId: participant2.registrationId,
        corner: Corner.WHITE,
      });
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

      // Guardar el antiguo ganador ANTES de actualizar
      const oldWinnerId = match.winnerRegistrationId;
      const winnerChanged =
        oldWinnerId && oldWinnerId !== dto.winnerRegistrationId;

      // Actualizar el match actual
      match.winnerRegistrationId = dto.winnerRegistrationId;
      match.status = MatchStatus.FINALIZADO;

      // Guardar scores totales
      if (dto.participant1Score !== undefined) {
        match.participant1Score = dto.participant1Score;
      }
      if (dto.participant2Score !== undefined) {
        match.participant2Score = dto.participant2Score;
      }

      // Guardar detalles de accuracy y presentation (Poomsae)
      if (dto.participant1Accuracy !== undefined) {
        match.participant1Accuracy = dto.participant1Accuracy;
      }
      if (dto.participant1Presentation !== undefined) {
        match.participant1Presentation = dto.participant1Presentation;
      }
      if (dto.participant2Accuracy !== undefined) {
        match.participant2Accuracy = dto.participant2Accuracy;
      }
      if (dto.participant2Presentation !== undefined) {
        match.participant2Presentation = dto.participant2Presentation;
      }

      await queryRunner.manager.save(match);

      // Si el match es de grupo, recalcular standings del grupo
      if (match.round === 'grupo') {
        await this._doRecalculateGroupStandings(queryRunner, match.phaseId);
      }


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
          winnerChanged ? oldWinnerId : undefined,
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
      await this.autoRegisterEliminationRanks(queryRunner, match.phaseId);
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
    oldWinnerId?: number,
  ): Promise<Match | null> {
    const nextMatch = await queryRunner.manager.findOne(Match, {
      where: {
        phaseId: currentMatch.phaseId,
        matchNumber: nextMatchNumber,
      },
      relations: ['participations'],
    });

    if (!nextMatch) return null;

    //Obtener TODOS los participantes del match actual
    const currentMatchParticipants = await queryRunner.manager.find(Participation, {
      where: { matchId: currentMatch.matchId },
    });

    const currentMatchRegistrationIds = currentMatchParticipants.map(
      (p) => p.registrationId,
    );

    // Eliminar los participantes del match actual que estén en el siguiente match
    // Esto previene la sobreposición de participantes
    for (const regId of currentMatchRegistrationIds) {
      if (regId) {
        const existingParticipation = nextMatch.participations.find(
          (p) => p.registrationId === regId,
        );

        if (existingParticipation) {
          await queryRunner.manager.delete(Participation, {
            participationId: existingParticipation.participationId,
          });

          console.log(
            `🗑️ Eliminado participante ${regId} del match ${nextMatch.matchId} (limpieza preventiva)`,
          );
        }
      }
    }

    // Recargar participaciones después de la limpieza
    const refreshedParticipations = await queryRunner.manager.find(Participation, {
      where: { matchId: nextMatch.matchId },
    });

    // Verificar si el nuevo ganador ya está participando
    const winnerAlreadyExists = refreshedParticipations.some(
      (p) => p.registrationId === winnerId,
    );

    if (!winnerAlreadyExists) {
      // Determinar corner basado en cuántos participantes hay
      const corner =
        refreshedParticipations.length === 0 ? Corner.BLUE : Corner.WHITE;

      await queryRunner.manager.save(Participation, {
        matchId: nextMatch.matchId,
        registrationId: winnerId,
        corner,
      });

      
    } else {
      console.log(
        `Ganador ${winnerId} ya está en el match ${nextMatch.matchId}`,
      );
    }

    // Limpiar el ganador del match de destino si había uno previo
    if (nextMatch.winnerRegistrationId) {
      nextMatch.winnerRegistrationId = undefined;
      nextMatch.status = MatchStatus.PROGRAMADO;
      await queryRunner.manager.save(nextMatch);
      
      console.log(
        `Reseteado estado del match ${nextMatch.matchId} (había ganador previo)`,
      );
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

    // Encontrar al perdedor actual
    const loserParticipation = semifinalMatch.participations.find(
      (p) => p.registrationId !== winnerId,
    );

    if (!loserParticipation) return null;

    const semifinalRegistrationIds = semifinalMatch.participations.map(
      (p) => p.registrationId,
    );

    // (esto incluye al ganador anterior y al perdedor anterior)
    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from(Participation)
      .where('matchId = :matchId', { matchId: thirdPlaceMatch.matchId })
      .andWhere('registrationId IN (:...ids)', { ids: semifinalRegistrationIds })
      .execute();

    console.log(
      `Eliminados participantes de semifinal ${semifinalMatch.matchId} del tercer lugar`,
    );

    const currentParticipations = await queryRunner.manager.find(Participation, {
      where: { matchId: thirdPlaceMatch.matchId },
    });

    // Determinar corner basado en cuántos quedan
    const corner = currentParticipations.length === 0 ? Corner.BLUE : Corner.WHITE;

    // Insertar al nuevo perdedor
    await queryRunner.manager.save(Participation, {
      matchId: thirdPlaceMatch.matchId,
      registrationId: loserParticipation.registrationId,
      corner,
    });

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

    // Los partidos de grupos no tienen siguiente match en el bracket
    if (currentRound === 'grupo') return null;
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
    if (!nextRoundName) return null; 

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

  private async autoRegisterEliminationRanks(
    queryRunner: any,
    phaseId: number,
  ): Promise<void> {
    const allMatches = await queryRunner.manager.find(Match, {
      where: { phaseId },
      relations: ['participations'],
    });

    const ranksToSave: Array<{ registrationId: number; rank: number }> = [];

    // 1ro y 2do desde la final
    const finalMatch = allMatches.find((m: Match) => m.round === 'final');
    if (
      finalMatch?.status === MatchStatus.FINALIZADO &&
      finalMatch.winnerRegistrationId
    ) {
      ranksToSave.push({ registrationId: finalMatch.winnerRegistrationId, rank: 1 });

      const finalLoser = finalMatch.participations.find(
        (p: Participation) => p.registrationId !== finalMatch.winnerRegistrationId,
      )?.registrationId;

      if (finalLoser) ranksToSave.push({ registrationId: finalLoser, rank: 2 });
    }

    // 3ro: tercer_lugar o perdedores de semifinal
    const thirdMatch = allMatches.find((m: Match) => m.round === 'tercer_lugar');
    if (thirdMatch) {
      if (
        thirdMatch.status === MatchStatus.FINALIZADO &&
        thirdMatch.winnerRegistrationId
      ) {
        ranksToSave.push({ registrationId: thirdMatch.winnerRegistrationId, rank: 3 });
      }
    } else {
      const semiMatches = allMatches.filter((m: Match) => m.round === 'semifinal');
      for (const semi of semiMatches) {
        if (semi.status !== MatchStatus.FINALIZADO || !semi.winnerRegistrationId) continue;
        const loser = semi.participations.find(
          (p: Participation) => p.registrationId !== semi.winnerRegistrationId,
        )?.registrationId;
        if (loser) ranksToSave.push({ registrationId: loser, rank: 3 });
      }
    }

    if (ranksToSave.length === 0) return;

    for (const { registrationId, rank } of ranksToSave) {
      const existing = await queryRunner.manager.findOne(PhaseManualRank, {
        where: { phaseId, registrationId },
      });
      if (existing) {
        existing.manualRankPosition = rank;
        await queryRunner.manager.save(existing);
      } else {
        await queryRunner.manager.save(
          queryRunner.manager.create(PhaseManualRank, {
            phaseId,
            registrationId,
            manualRankPosition: rank,
          }),
        );
      }
    }
  }

// ==================== FASE DE GRUPOS (GROUP STAGE) ====================

  /**
   * Crea los grupos dentro de una fase de eliminación padre,
   * inicializa GroupStandings y genera los partidos round-robin de cada grupo.
   */
  async createGroupStageForPhase(
    parentPhaseId: number,
    groups: GroupDefinitionDto[],
    qualifiersPerGroup: number,
  ): Promise<Phase[]> {
    const createdGroups: Phase[] = [];


    const parentPhase = await this.phaseRepository.findOne({
      where: { phaseId: parentPhaseId },
    });

    if (!parentPhase) {
      throw new NotFoundException(`Fase padre ${parentPhaseId} no encontrada`);
    }


    for (const [idx, group] of groups.entries()) {
      const groupPhase = this.phaseRepository.create({
        parentPhaseId,
        eventCategoryId: parentPhase.eventCategoryId,
        type: PhaseType.GROUP_STAGE,
        name: `Grupo ${group.label}`,
        groupLabel: group.label,
        qualifiersCount: qualifiersPerGroup,
        displayOrder: idx + 1,
      });
      const saved = await this.phaseRepository.save(groupPhase);

      // GroupStanding (ya existía)
      const groupStandings = group.registrationIds.map((registrationId) =>
        this.groupStandingRepository.create({
          phaseId: saved.phaseId,
          registrationId,
        }),
      );
      await this.groupStandingRepository.save(groupStandings);

      // Standing — necesario para que updateStandings funcione ← NUEVO
      const standings = group.registrationIds.map((registrationId) =>
        this.standingRepository.create({
          phaseId: saved.phaseId,
          registrationId,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          scoreFor: 0,
          scoreAgainst: 0,
          scoreDiff: 0,
        }),
      );
      await this.standingRepository.save(standings);

      await this.generateRoundRobinMatches(saved.phaseId, group.registrationIds);

      createdGroups.push(saved);
    }

    return createdGroups;
  }

  /**
   * Cierra todos los grupos de una fase padre:
   * calcula rankings, marca clasificados y retorna los IDs
   * para sembrar el bracket de eliminación.
   */
    async closeGroupsAndGetQualifiers(parentPhaseId: number): Promise<{
    qualifiedIds: number[];
    groupResults: Array<{
      groupLabel: string;
      standings: GroupStanding[];
      qualified: number[];
    }>;
    bracketMatches: Match[];
  }> {
    const subPhases = await this.phaseRepository.find({
      where: { parentPhaseId },
      order: { displayOrder: 'ASC' },
    });

    if (subPhases.length === 0) {
      throw new BadRequestException(
        `La fase ${parentPhaseId} no tiene sub-fases de grupos`,
      );
    }

    // Verificar que no haya partidos pendientes en ningún grupo
    for (const sub of subPhases) {
      const pendingMatches = await this.matchRepository.count({
        where: { phaseId: sub.phaseId, status: MatchStatus.PROGRAMADO },
      });
      if (pendingMatches > 0) {
        throw new BadRequestException(
          `El ${sub.name} tiene ${pendingMatches} partido(s) pendiente(s). Finaliza todos antes de cerrar los grupos.`,
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const groupResults: Array<{
        groupLabel: string;
        standings: GroupStanding[];
        qualified: number[];
      }> = [];
      const allQualifiedIds: number[] = [];

      for (const sub of subPhases) {
        await this._doRecalculateGroupStandings(queryRunner, sub.phaseId);

        const standings = await queryRunner.manager.find(GroupStanding, {
          where: { phaseId: sub.phaseId },
          order: {
            points: 'DESC',
            pointDifference: 'DESC',
            pointsFor: 'DESC',
          },
        });

        const qualifiersCount = sub.qualifiersCount ?? 2;

        for (let i = 0; i < standings.length; i++) {
          standings[i].finalRank = i + 1;
          standings[i].qualified = i < qualifiersCount;
        }
        await queryRunner.manager.save(GroupStanding, standings);

        groupResults.push({
          groupLabel: sub.groupLabel ?? sub.name,
          standings,
          qualified: standings
            .filter((s) => s.qualified)
            .map((s) => s.registrationId),
        });
      }

      // Seeding intercalado: 1°GrupoA, 1°GrupoB, 2°GrupoA, 2°GrupoB...
      const maxQualifiers = Math.max(...groupResults.map((g) => g.qualified.length));
      for (let i = 0; i < maxQualifiers; i++) {
        for (const group of groupResults) {
          if (group.qualified[i] !== undefined) {
            allQualifiedIds.push(group.qualified[i]);
          }
        }
      }

      // ── NUEVO: guardar clasificados como PhaseRegistration en fase padre ──
      // Esto permite que el modal de asignación manual sepa qué participantes
      // están disponibles para llenar los slots del bracket.
      const existingParentRegs = await queryRunner.manager.find(PhaseRegistration, {
        where: { phaseId: parentPhaseId },
      });
      if (existingParentRegs.length > 0) {
        await queryRunner.manager.remove(PhaseRegistration, existingParentRegs);
      }
      const parentPhaseRegs = allQualifiedIds.map((registrationId) =>
        queryRunner.manager.create(PhaseRegistration, {
          phaseId: parentPhaseId,
          registrationId,
        }),
      );
      if (parentPhaseRegs.length > 0) {
        await queryRunner.manager.save(PhaseRegistration, parentPhaseRegs);
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── Anti-duplicado: eliminar matches previos de la fase padre ─────────
      const existingEliminationMatches = await queryRunner.manager.find(Match, {
        where: { phaseId: parentPhaseId },
      });
      if (existingEliminationMatches.length > 0) {
        const existingMatchIds = existingEliminationMatches.map((m) => m.matchId);
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(Participation)
          .where('matchId IN (:...ids)', { ids: existingMatchIds })
          .execute();

        await queryRunner.manager.remove(Match, existingEliminationMatches);
      }

      // Calcular estructura del bracket según cantidad de clasificados
      const numParticipants = allQualifiedIds.length;

      // Guard: necesitamos al menos 2 clasificados para generar bracket
      if (numParticipants < 2) {
        throw new BadRequestException(
          `Se necesitan al menos 2 clasificados para generar el bracket. Solo hay ${numParticipants}.`,
        );
      }

      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
      const totalRounds = Math.log2(nextPowerOf2);

      const bracketMatches: Match[] = [];
      let matchNumber = 1;

      for (let round = 0; round < totalRounds; round++) {
        const matchesInRound = nextPowerOf2 / Math.pow(2, round + 1);
        const roundName = this.getRoundName(matchesInRound);

        for (let i = 0; i < matchesInRound; i++) {
          const match = queryRunner.manager.create(Match, {
            phaseId: parentPhaseId,
            matchNumber: matchNumber++,
            round: roundName,
            status: MatchStatus.PROGRAMADO,
          });
          const savedMatch = await queryRunner.manager.save(Match, match);
          bracketMatches.push(savedMatch);
        }
      }

      await queryRunner.commitTransaction();

      return { qualifiedIds: allQualifiedIds, groupResults, bracketMatches };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Recalcula los GroupStandings de un grupo desde los partigenerate-phases.dto.tsdos finalizados.
   * 
   * Puede llamarse de dos formas:
   *  1. Con queryRunner externo (uso interno en transacciones): recalculateGroupStandings(queryRunner, phaseId)
   *  2. Sin queryRunner (uso externo desde otros servicios):     recalculateGroupStandings(phaseId)
   */
  async recalculateGroupStandings(groupPhaseId: number): Promise<void>;
  async recalculateGroupStandings(queryRunner: any, groupPhaseId: number): Promise<void>;
  async recalculateGroupStandings(
    queryRunnerOrPhaseId: any,
    groupPhaseId?: number,
  ): Promise<void> {
    // Sobrecarga: si se llama solo con un número, crear queryRunner propio
    if (typeof queryRunnerOrPhaseId === 'number') {
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        await this._doRecalculateGroupStandings(qr, queryRunnerOrPhaseId);
        await qr.commitTransaction();
      } catch (e) {
        await qr.rollbackTransaction();
        throw e;
      } finally {
        await qr.release();
      }
      return;
    }

    // Uso interno: se pasa queryRunner externo
    await this._doRecalculateGroupStandings(queryRunnerOrPhaseId, groupPhaseId!);
  }

  /**
   * Lógica real del recálculo — siempre usa un queryRunner.
   * No llamar directamente desde fuera de BracketService.
   */
  private async _doRecalculateGroupStandings(
    queryRunner: any,
    groupPhaseId: number,
  ): Promise<void> {
    const matches = await queryRunner.manager.find(Match, {
      where: { phaseId: groupPhaseId, status: MatchStatus.FINALIZADO },
      relations: ['participations'],
    });

    let standings = await queryRunner.manager.find(GroupStanding, {
      where: { phaseId: groupPhaseId },
    });

    const allParticipantIds = new Set<number>();
    for (const match of matches) {
      for (const p of match.participations) {
        if (p.registrationId) allParticipantIds.add(p.registrationId);
      }
    }

    for (const regId of allParticipantIds) {
      const exists = standings.find((s) => s.registrationId === regId);
      if (!exists) {
        const newStanding = queryRunner.manager.create(GroupStanding, {
          phaseId: groupPhaseId,
          registrationId: regId,
          played: 0, won: 0, drawn: 0, lost: 0,
          pointsFor: 0, pointsAgainst: 0, pointDifference: 0, points: 0,
        });
        const saved = await queryRunner.manager.save(GroupStanding, newStanding);
        standings.push(saved);
      }
    }

    for (const s of standings) {
      s.played = 0; s.won = 0; s.drawn = 0; s.lost = 0;
      s.pointsFor = 0; s.pointsAgainst = 0; s.pointDifference = 0; s.points = 0;
    }

    const standingMap = new Map<number, GroupStanding>(
      standings.map((s) => [s.registrationId, s]),
    );

    for (const match of matches) {
      if (match.participations.length < 2) continue;

      const p1RegId = match.participations[0].registrationId;
      const p2RegId = match.participations[1].registrationId;

      if (!p1RegId || !p2RegId) continue;

      const s1 = standingMap.get(p1RegId);
      const s2 = standingMap.get(p2RegId);
      if (!s1 || !s2) continue;

      const score1 = Number(match.participant1Score) || 0;
      const score2 = Number(match.participant2Score) || 0;

      s1.played++; s2.played++;

      s1.pointsFor     = Number(s1.pointsFor)     + score1;
      s1.pointsAgainst = Number(s1.pointsAgainst) + score2;
      s2.pointsFor     = Number(s2.pointsFor)     + score2;
      s2.pointsAgainst = Number(s2.pointsAgainst) + score1;
      s1.pointDifference = s1.pointsFor - s1.pointsAgainst;
      s2.pointDifference = s2.pointsFor - s2.pointsAgainst;

      if (match.winnerRegistrationId === p1RegId) {
        s1.won++; s1.points += 3; s2.lost++;
      } else if (match.winnerRegistrationId === p2RegId) {
        s2.won++; s2.points += 3; s1.lost++;
      } else {
        s1.drawn++; s1.points += 1;
        s2.drawn++; s2.points += 1;
      }
    }

    await queryRunner.manager.save(GroupStanding, standings);
  }

  /**
   * Genera todos los partidos round-robin (todos vs todos) para un grupo.
   */
  private async generateRoundRobinMatches(
    groupPhaseId: number,
    registrationIds: number[],
  ): Promise<void> {
    let matchNumber = 1;

    for (let i = 0; i < registrationIds.length; i++) {
      for (let j = i + 1; j < registrationIds.length; j++) {
        const match = await this.matchRepository.save(
          this.matchRepository.create({
            phaseId: groupPhaseId,
            matchNumber: matchNumber++,
            round: 'grupo',
            status: MatchStatus.PROGRAMADO,
          }),
        );

        await this.participationRepository.save([
          this.participationRepository.create({
            matchId: match.matchId,
            registrationId: registrationIds[i],
            corner: Corner.BLUE,
          }),
          this.participationRepository.create({
            matchId: match.matchId,
            registrationId: registrationIds[j],
            corner: Corner.WHITE,
          }),
        ]);
      }
    }
  }

}