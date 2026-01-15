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
   * 1. Establecer lineup de un equipo para un match
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
   * 3. Generar juegos automáticamente basados en los lineups
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

    // Obtener lineups
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

    // Eliminar juegos existentes
    await this.gameRepository.delete({ matchId });

    // Formato estándar de tenis de mesa por equipos:
    // Juego 1: A vs X
    // Juego 2: B vs Y
    // Juego 3: C vs Z
    // Juego 4: A vs Y
    // Juego 5: B vs Z

    const gamesConfig = [
      { gameNumber: 1, player1Index: 0, player2Index: 0, label: 'A vs X' }, // A vs X
      { gameNumber: 2, player1Index: 1, player2Index: 1, label: 'B vs Y' }, // B vs Y
      { gameNumber: 3, player1Index: 2, player2Index: 2, label: 'C vs Z' }, // C vs Z
      { gameNumber: 4, player1Index: 0, player2Index: 1, label: 'A vs Y' }, // A vs Y
      { gameNumber: 5, player1Index: 1, player2Index: 2, label: 'B vs Z' }, // B vs Z
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
      games: savedGames,
      format: 'Mejor de 5 juegos',
      gameSequence: gamesConfig.map((c) => c.label),
    };
  }

  /**
   * 4. Actualizar resultado de un juego individual
   */
  async updateGameResult(gameId: number, dto: UpdateMatchGameDto) {
    const game = await this.gameRepository.findOne({
      where: { gameId },
      relations: ['player1', 'player2'],
    });

    if (!game) {
      throw new NotFoundException('Juego no encontrado');
    }

    // Actualizar campos
    if (dto.score1 !== undefined) game.score1 = dto.score1;
    if (dto.score2 !== undefined) game.score2 = dto.score2;
    if (dto.status !== undefined) game.status = dto.status;

    // Determinar ganador automáticamente si se completaron los scores
    if (game.score1 !== null && game.score2 !== null) {
      game.winnerId =
        game.score1 > game.score2 ? game.player1Id : game.player2Id;
      game.status = GameStatus.COMPLETED;
      game.completedAt = new Date();
    }

    // Actualizar started_at si es el primer update
    if (game.status === GameStatus.IN_PROGRESS && !game.startedAt) {
      game.startedAt = new Date();
    }

    const savedGame = await this.gameRepository.save(game);

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
   * 6. Calcular resultado del match completo
   */
  async calculateMatchResult(matchId: number) {
    const games = await this.getMatchGames(matchId);
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
}
