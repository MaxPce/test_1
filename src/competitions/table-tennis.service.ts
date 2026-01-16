import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchLineup } from './entities/match-lineup.entity';
import { MatchGame, GameStatus } from './entities/match-game.entity';
import { Match } from './entities/match.entity';
import { Participation } from './entities/participation.entity';
import { SetMatchLineupDto } from './dto/match-lineup.dto';
import { UpdateMatchGameDto } from './dto/match-game.dto';

@Injectable()
export class TableTennisService {
  constructor(
    @InjectRepository(MatchLineup)
    private lineupRepository: Repository<MatchLineup>,
    @InjectRepository(MatchGame)
    private gameRepository: Repository<MatchGame>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Participation)
    private participationRepository: Repository<Participation>,
  ) {}

  /**
   * Detectar modalidad del match - SOLO PARA TENIS DE MESA
   */
  private async detectMatchModality(
    matchId: number,
  ): Promise<'individual' | 'doubles' | 'team'> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: [
        'phase',
        'phase.eventCategory',
        'phase.eventCategory.category',
        'phase.eventCategory.category.sport',
      ],
    });

    if (!match) {
      throw new NotFoundException('Match no encontrado');
    }

    // ✅ VALIDACIÓN CRÍTICA: Solo para tenis de mesa
    const sportName =
      match.phase?.eventCategory?.category?.sport?.name?.toLowerCase() || '';
    if (
      !sportName.includes('tenis de mesa') &&
      !sportName.includes('tennis de mesa')
    ) {
      throw new BadRequestException(
        'Esta funcionalidad es exclusiva para Tenis de Mesa',
      );
    }

    const categoryType =
      match.phase?.eventCategory?.category?.type?.toLowerCase() || '';

    // Si es individual en la BD, retornar individual
    if (categoryType === 'individual') {
      return 'individual';
    }

    // Si es equipo, detectar por cantidad de miembros
    if (categoryType === 'equipo' || categoryType === 'equipos') {
      const participations = await this.participationRepository.find({
        where: { matchId },
        relations: [
          'registration',
          'registration.team',
          'registration.team.members',
          'registration.athlete',
        ],
      });

      if (participations.length > 0) {
        const firstParticipation = participations[0];

        // Si tiene athlete directo, es individual
        if (firstParticipation.registration.athlete) {
          return 'individual';
        }

        // Si tiene team, verificar tamaño
        const teamSize =
          firstParticipation.registration.team?.members?.length || 0;

        if (teamSize === 2) {
          return 'doubles'; // ✅ Dobles: equipo de 2
        }

        if (teamSize >= 3) {
          return 'team'; // ✅ Equipos: 3 o más
        }
      }
    }

    // Default: equipo
    return 'team';
  }

  /**
   * 1. Establecer lineup de un equipo para un match (SOLO EQUIPOS)
   */
  async setLineup(participationId: number, dto: SetMatchLineupDto) {
    // Verificar que la participación existe
    const participation = await this.participationRepository.findOne({
      where: { participationId },
      relations: [
        'registration',
        'registration.team',
        'registration.team.members',
      ],
    });

    if (!participation) {
      throw new NotFoundException('Participación no encontrada');
    }

    if (!participation.registration.team) {
      throw new BadRequestException('Esta participación no es de un equipo');
    }

    // Verificar que todos los atletas pertenecen al equipo
    const teamAthleteIds = participation.registration.team.members.map(
      (m) => m.athleteId,
    );
    const invalidAthletes = dto.lineups.filter(
      (l) => !teamAthleteIds.includes(l.athleteId),
    );

    if (invalidAthletes.length > 0) {
      throw new BadRequestException(
        'Algunos atletas no pertenecen a este equipo',
      );
    }

    // Validar que hay exactamente 3 titulares y 1 suplente
    const titulares = dto.lineups.filter((l) => !l.isSubstitute);
    const suplentes = dto.lineups.filter((l) => l.isSubstitute);

    if (titulares.length !== 3) {
      throw new BadRequestException(
        'Debe haber exactamente 3 jugadores titulares',
      );
    }

    if (suplentes.length !== 1) {
      throw new BadRequestException(
        'Debe haber exactamente 1 jugador suplente',
      );
    }

    // Eliminar lineup anterior
    await this.lineupRepository.delete({ participationId });

    // Crear nuevo lineup
    const lineups = dto.lineups.map((l) =>
      this.lineupRepository.create({
        participationId,
        athleteId: l.athleteId,
        lineupOrder: l.lineupOrder,
        isSubstitute: l.isSubstitute,
      }),
    );

    const savedLineups = await this.lineupRepository.save(lineups);

    return {
      message: 'Lineup configurado exitosamente',
      lineups: savedLineups,
    };
  }

  /**
   * 2. Obtener lineup de un match (ambos equipos)
   */
  async getMatchLineups(matchId: number) {
    const participations = await this.participationRepository.find({
      where: { matchId },
      relations: [
        'registration',
        'registration.team',
        'registration.team.institution',
      ],
    });

    if (participations.length === 0) {
      throw new NotFoundException(
        'No se encontraron participaciones para este match',
      );
    }

    const lineupsData = await Promise.all(
      participations.map(async (participation) => {
        const lineups = await this.lineupRepository.find({
          where: { participationId: participation.participationId },
          relations: ['athlete', 'athlete.institution'],
          order: { lineupOrder: 'ASC' },
        });

        return {
          participation,
          lineups,
          teamName: participation.registration.team?.name,
          institution: participation.registration.team?.institution?.name,
          hasLineup: lineups.length > 0,
        };
      }),
    );

    return lineupsData;
  }

  /**
   * 3. Generar juegos automáticamente según modalidad
   */
  async generateGames(matchId: number) {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: [
        'phase',
        'phase.eventCategory',
        'phase.eventCategory.category',
        'phase.eventCategory.category.sport',
      ],
    });

    if (!match) {
      throw new NotFoundException('Match no encontrado');
    }

    // Verificar que es tenis de mesa
    const sportName =
      match.phase?.eventCategory?.category?.sport?.name?.toLowerCase() || '';
    if (
      !sportName.includes('tenis de mesa') &&
      !sportName.includes('tennis de mesa')
    ) {
      throw new BadRequestException('Este match no es de tenis de mesa');
    }

    // ✅ Detectar modalidad
    const modality = await this.detectMatchModality(matchId);

    console.log('🏓 Modalidad detectada:', modality);

    // Eliminar juegos existentes
    await this.gameRepository.delete({ matchId });

    // ✅ Generar juegos según modalidad
    switch (modality) {
      case 'individual':
        return await this.generateIndividualGames(matchId);

      case 'doubles':
        return await this.generateDoublesGames(matchId);

      case 'team':
        return await this.generateTeamGames(matchId);

      default:
        throw new BadRequestException('Modalidad no soportada');
    }
  }

  /**
   * Generar juego para Individual (1 vs 1)
   */
  private async generateIndividualGames(matchId: number) {
    const participations = await this.participationRepository.find({
      where: { matchId },
      relations: ['registration', 'registration.athlete'],
    });

    if (participations.length !== 2) {
      throw new BadRequestException(
        'El match individual debe tener exactamente 2 participantes',
      );
    }

    const player1 = participations[0].registration.athlete;
    const player2 = participations[1].registration.athlete;

    if (!player1 || !player2) {
      throw new BadRequestException(
        'No se encontraron los atletas. Asegúrate de que ambas registrations sean individuales.',
      );
    }

    const game = this.gameRepository.create({
      matchId,
      gameNumber: 1,
      player1Id: player1.athleteId,
      player2Id: player2.athleteId,
      status: GameStatus.PENDING,
    });

    const savedGame = await this.gameRepository.save(game);

    return {
      message: 'Juego generado exitosamente',
      modality: 'individual',
      games: [savedGame],
      format: 'Individual - Mejor de 5 sets',
    };
  }

  /**
   * Generar juego para Dobles (Pareja vs Pareja)
   */
  private async generateDoublesGames(matchId: number) {
    const participations = await this.participationRepository.find({
      where: { matchId },
      relations: [
        'registration',
        'registration.team',
        'registration.team.members',
        'registration.team.members.athlete',
      ],
    });

    if (participations.length !== 2) {
      throw new BadRequestException(
        'El match de dobles debe tener exactamente 2 parejas',
      );
    }

    const team1Members = participations[0].registration.team?.members || [];
    const team2Members = participations[1].registration.team?.members || [];

    if (team1Members.length !== 2 || team2Members.length !== 2) {
      throw new BadRequestException(
        'Cada pareja debe tener exactamente 2 jugadores registrados',
      );
    }

    // Para dobles, usamos el primer miembro como representante
    const game = this.gameRepository.create({
      matchId,
      gameNumber: 1,
      player1Id: team1Members[0].athleteId,
      player2Id: team2Members[0].athleteId,
      status: GameStatus.PENDING,
    });

    const savedGame = await this.gameRepository.save(game);

    return {
      message: 'Juego generado exitosamente',
      modality: 'doubles',
      games: [savedGame],
      format: 'Dobles - Mejor de 5 sets',
      team1Players: team1Members.map((m) => m.athlete.name).join(' / '),
      team2Players: team2Members.map((m) => m.athlete.name).join(' / '),
    };
  }

  /**
   * Generar juegos para Equipos (3 vs 3)
   */
  private async generateTeamGames(matchId: number) {
    const lineupsData = await this.getMatchLineups(matchId);

    if (lineupsData.length !== 2) {
      throw new BadRequestException(
        'El match debe tener exactamente 2 equipos',
      );
    }

    const team1Lineups = lineupsData[0].lineups.filter((l) => !l.isSubstitute);
    const team2Lineups = lineupsData[1].lineups.filter((l) => !l.isSubstitute);

    if (team1Lineups.length < 3 || team2Lineups.length < 3) {
      throw new BadRequestException(
        'Cada equipo debe tener configurado su lineup con 3 jugadores titulares',
      );
    }

    const gamesConfig = [
      { gameNumber: 1, player1Index: 0, player2Index: 0, label: 'A vs X' },
      { gameNumber: 2, player1Index: 1, player2Index: 1, label: 'B vs Y' },
      { gameNumber: 3, player1Index: 2, player2Index: 2, label: 'C vs Z' },
      { gameNumber: 4, player1Index: 0, player2Index: 1, label: 'A vs Y' },
      { gameNumber: 5, player1Index: 1, player2Index: 2, label: 'B vs Z' },
    ];

    const createdGames = gamesConfig.map((config) =>
      this.gameRepository.create({
        matchId,
        gameNumber: config.gameNumber,
        player1Id: team1Lineups[config.player1Index].athleteId,
        player2Id: team2Lineups[config.player2Index].athleteId,
        status: GameStatus.PENDING,
      }),
    );

    const savedGames = await this.gameRepository.save(createdGames);

    return {
      message: 'Juegos generados exitosamente',
      modality: 'team',
      games: savedGames,
      format: 'Equipos - Mejor de 5 juegos',
      gameSequence: gamesConfig.map((c) => c.label),
    };
  }

  /**
   * 4. Actualizar resultado de un juego individual
   */
  async updateGameResult(gameId: number, dto: UpdateMatchGameDto) {
    const game = await this.gameRepository.findOne({
      where: { gameId },
      relations: ['player1', 'player2', 'match'], // ✅ AGREGAR relación 'match'
    });

    if (!game) {
      throw new NotFoundException('Juego no encontrado');
    }

    // ✅ NUEVO: Si el match está finalizado, reabrirlo automáticamente
    if (game.match.status === 'finalizado') {
      game.match.status = 'en_curso' as any;
      game.match.winnerRegistrationId = undefined;
      await this.matchRepository.save(game.match);

      console.log(
        `✅ Match ${game.match.matchId} reabierto automáticamente para permitir edición del juego ${gameId}`,
      );
    }

    // ✅ CASO 1: Si se envían sets (TENIS DE MESA)
    if (dto.sets && dto.sets.length > 0) {
      // Validar que no haya más de 5 sets
      if (dto.sets.length > 5) {
        throw new BadRequestException('Un juego no puede tener más de 5 sets');
      }

      // Validar puntuación de cada set
      for (const set of dto.sets) {
        const maxScore = Math.max(set.player1Score, set.player2Score);
        const minScore = Math.min(set.player1Score, set.player2Score);
        const diff = maxScore - minScore;

        if (maxScore < 11) {
          throw new BadRequestException(
            `Set ${set.setNumber}: El ganador debe tener al menos 11 puntos`,
          );
        }

        if (diff < 2) {
          throw new BadRequestException(
            `Set ${set.setNumber}: Debe haber diferencia de al menos 2 puntos`,
          );
        }

        // Determinar ganador del set
        set.winnerId =
          set.player1Score > set.player2Score ? game.player1Id : game.player2Id;
      }

      game.sets = dto.sets;

      // Calcular score1 y score2 automáticamente
      game.score1 = dto.sets.filter(
        (s) => s.winnerId === game.player1Id,
      ).length;
      game.score2 = dto.sets.filter(
        (s) => s.winnerId === game.player2Id,
      ).length;

      // Determinar si el juego está completo (alguien ganó 3 sets)
      if (game.score1 >= 3 || game.score2 >= 3) {
        game.winnerId =
          game.score1 > game.score2 ? game.player1Id : game.player2Id;
        game.status = GameStatus.COMPLETED;
        game.completedAt = new Date();
      } else {
        game.status = GameStatus.IN_PROGRESS;
      }
    }

    // ✅ CASO 2: Actualización manual de scores (OTROS DEPORTES)
    if (dto.score1 !== undefined) game.score1 = dto.score1;
    if (dto.score2 !== undefined) game.score2 = dto.score2;
    if (dto.status !== undefined) game.status = dto.status;

    // Si se envía winnerId manualmente (otros deportes)
    if (dto.winnerId !== undefined) {
      game.winnerId = dto.winnerId;
    }

    // Actualizar started_at si es el primer update
    if (
      (game.status === GameStatus.IN_PROGRESS || game.sets) &&
      !game.startedAt
    ) {
      game.startedAt = new Date();
    }

    const savedGame = await this.gameRepository.save(game);

    // ✅ NUEVO: Cambiar match a "en_curso" si estaba programado
    if (game.match.status === 'programado') {
      game.match.status = 'en_curso' as any;
      await this.matchRepository.save(game.match);
    }

    return {
      message: 'Resultado actualizado exitosamente',
      game: savedGame,
    };
  }

  /**
   * 5. Obtener juegos de un match con toda la info
   */
  async getMatchGames(matchId: number) {
    const games = await this.gameRepository.find({
      where: { matchId },
      relations: [
        'player1',
        'player1.institution',
        'player2',
        'player2.institution',
        'winner',
      ],
      order: { gameNumber: 'ASC' },
    });

    return games;
  }

  /**
   * 6. Calcular resultado del match completo (adaptado a todas las modalidades)
   */
  async calculateMatchResult(matchId: number) {
    const games = await this.getMatchGames(matchId);

    // ✅ Detectar modalidad
    const modality = await this.detectMatchModality(matchId);

    if (modality === 'team') {
      // Lógica para equipos (requiere lineups)
      return await this.calculateTeamMatchResult(matchId, games);
    } else {
      // Lógica para individual y dobles (sin lineups)
      return await this.calculateIndividualDoublesResult(matchId, games);
    }
  }

  /**
   * Calcular resultado para Individual/Dobles
   */
  private async calculateIndividualDoublesResult(
    matchId: number,
    games: any[],
  ) {
    const participations = await this.participationRepository.find({
      where: { matchId },
      relations: [
        'registration',
        'registration.athlete',
        'registration.team',
        'registration.team.members',
        'registration.team.members.athlete',
      ],
    });

    if (participations.length !== 2) {
      throw new BadRequestException('El match debe tener 2 participantes');
    }

    const game = games[0]; // Solo hay 1 juego

    // ✅ CAMBIO: Solo contar como "win" si el juego está COMPLETADO
    let team1Wins = 0;
    let team2Wins = 0;

    if (game && game.status === GameStatus.COMPLETED) {
      // Solo si el juego terminó, contar el ganador
      if (game.winnerId === game.player1Id) {
        team1Wins = 1;
      } else if (game.winnerId === game.player2Id) {
        team2Wins = 1;
      }
    }
    // Si el juego está en progreso o pendiente, wins = 0 - 0

    const isComplete = game?.status === GameStatus.COMPLETED;
    const winnerParticipation = isComplete
      ? team1Wins > team2Wins
        ? participations[0]
        : participations[1]
      : null;

    return {
      team1: {
        participation: participations[0],
        teamName:
          participations[0].registration.athlete?.name ||
          participations[0].registration.team?.name ||
          'Participante 1',
        wins: team1Wins,
        lineups: [],
      },
      team2: {
        participation: participations[1],
        teamName:
          participations[1].registration.athlete?.name ||
          participations[1].registration.team?.name ||
          'Participante 2',
        wins: team2Wins,
        lineups: [],
      },
      games,
      isComplete,
      winner: winnerParticipation,
      score: `${team1Wins} - ${team2Wins}`,
    };
  }

  /**
   * Calcular resultado para Equipos (lógica original)
   */
  private async calculateTeamMatchResult(matchId: number, games: any[]) {
    const lineups = await this.getMatchLineups(matchId);

    if (lineups.length !== 2) {
      throw new BadRequestException('El match debe tener 2 equipos');
    }

    const team1AthleteIds = lineups[0].lineups.map((l) => l.athleteId);
    const team2AthleteIds = lineups[1].lineups.map((l) => l.athleteId);

    let team1Wins = 0;
    let team2Wins = 0;

    for (const game of games) {
      if (game.winnerId) {
        if (team1AthleteIds.includes(game.winnerId)) {
          team1Wins++;
        } else if (team2AthleteIds.includes(game.winnerId)) {
          team2Wins++;
        }
      }
    }

    const isComplete = games.every((g) => g.status === GameStatus.COMPLETED);
    const winnerParticipation =
      team1Wins > team2Wins
        ? lineups[0].participation
        : team2Wins > team1Wins
          ? lineups[1].participation
          : null;

    return {
      team1: {
        participation: lineups[0].participation,
        teamName: lineups[0].teamName,
        wins: team1Wins,
        lineups: lineups[0].lineups,
      },
      team2: {
        participation: lineups[1].participation,
        teamName: lineups[1].teamName,
        wins: team2Wins,
        lineups: lineups[1].lineups,
      },
      games,
      isComplete,
      winner: winnerParticipation,
      score: `${team1Wins} - ${team2Wins}`,
    };
  }

  /**
   * 7. Obtener el estado completo de un match de tenis de mesa
   */
  async getMatchDetails(matchId: number) {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: [
        'phase',
        'phase.eventCategory',
        'phase.eventCategory.category',
      ],
    });

    if (!match) {
      throw new NotFoundException('Match no encontrado');
    }

    const lineups = await this.getMatchLineups(matchId);
    const games = await this.getMatchGames(matchId);

    // ✅ Calcular resultado solo si hay juegos
    const result =
      games.length > 0 ? await this.calculateMatchResult(matchId) : null;

    return {
      match,
      lineups,
      games,
      result,
      hasLineups: lineups.every((l) => l.hasLineup),
      hasGames: games.length > 0,
    };
  }

  /**
   * Finalizar match manualmente
   */
  async finalizeMatch(matchId: number) {
    const match = await this.matchRepository.findOne({
      where: { matchId },
    });

    if (!match) {
      throw new NotFoundException('Match no encontrado');
    }

    // Calcular resultado
    const result = await this.calculateMatchResult(matchId);

    if (!result.winner) {
      throw new BadRequestException(
        'No se puede finalizar el match sin un ganador determinado',
      );
    }

    // ✅ CAMBIO: Asegurarse de que registrationId no sea null
    if (!result.winner.registrationId) {
      throw new BadRequestException(
        'El ganador no tiene un registrationId válido',
      );
    }

    // Actualizar match
    match.status = 'finalizado' as any;
    match.winnerRegistrationId = result.winner.registrationId; // ✅ Ahora TypeScript sabe que no es null

    await this.matchRepository.save(match);

    return {
      message: 'Match finalizado exitosamente',
      match,
      result,
    };
  }

  /**
   * Reabrir match (cambiar de finalizado a en_curso para permitir ediciones)
   */
  async reopenMatch(matchId: number) {
    const match = await this.matchRepository.findOne({
      where: { matchId },
    });

    if (!match) {
      throw new NotFoundException('Match no encontrado');
    }

    if (match.status !== 'finalizado') {
      throw new BadRequestException('El match no está finalizado');
    }

    // Cambiar status a en_curso
    match.status = 'en_curso' as any;
    match.winnerRegistrationId = undefined; // Limpiar ganador

    await this.matchRepository.save(match);

    return {
      message: 'Match reabierto exitosamente',
      match,
    };
  }
}
