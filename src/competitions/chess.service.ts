import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChessRound } from './entities/chess-round.entity';
import { ChessMatch } from './entities/chess-match.entity';
import { PhaseRegistration } from './entities/phase-registration.entity';
import { CreateChessRoundDto, UpdateChessRoundDto } from './dto/chess-round.dto';
import { CreateChessMatchDto, UpdateChessMatchDto } from './dto/chess-match.dto';

@Injectable()
export class ChessService {
  constructor(
    @InjectRepository(ChessRound)
    private readonly chessRoundRepo: Repository<ChessRound>,

    @InjectRepository(ChessMatch)
    private readonly chessMatchRepo: Repository<ChessMatch>,

    @InjectRepository(PhaseRegistration)
    private readonly phaseRegRepo: Repository<PhaseRegistration>,
  ) {}

  // ── RONDAS ────────────────────────────────────────────────────────

  async getRoundsByPhase(phaseId: number): Promise<ChessRound[]> {
    return this.chessRoundRepo.find({
      where: { phaseId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createRound(dto: CreateChessRoundDto): Promise<ChessRound> {
    const existing = await this.chessRoundRepo.findOne({
      where: { phaseId: dto.phaseId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Ya existe una ronda con ese nombre en esta fase');
    }
    const round = this.chessRoundRepo.create({
      phaseId: dto.phaseId,
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.chessRoundRepo.save(round);
  }

  async updateRound(id: number, dto: UpdateChessRoundDto): Promise<ChessRound> {
    const round = await this.chessRoundRepo.findOneOrFail({
      where: { chessRoundId: id },
    });
    if (dto.name !== undefined) round.name = dto.name;
    if (dto.sortOrder !== undefined) round.sortOrder = dto.sortOrder;
    return this.chessRoundRepo.save(round);
  }

  async deleteRound(id: number): Promise<{ deleted: boolean }> {
    await this.chessRoundRepo.findOneOrFail({ where: { chessRoundId: id } });
    await this.chessRoundRepo.delete(id);
    return { deleted: true };
  }

  // ── MATCHES ───────────────────────────────────────────────────────

  async getMatchesByRound(chessRoundId: number): Promise<any[]> {
    const matches = await this.chessMatchRepo.find({
      where: { chessRoundId },
      relations: [
        'whitePhaseRegistration',
        'whitePhaseRegistration.registration',
        'whitePhaseRegistration.registration.athlete',
        'whitePhaseRegistration.registration.athlete.institution',
        'whitePhaseRegistration.registration.team',
        'whitePhaseRegistration.registration.team.institution',
        'blackPhaseRegistration',
        'blackPhaseRegistration.registration',
        'blackPhaseRegistration.registration.athlete',
        'blackPhaseRegistration.registration.athlete.institution',
        'blackPhaseRegistration.registration.team',
        'blackPhaseRegistration.registration.team.institution',
      ],
      order: { boardNumber: 'ASC', createdAt: 'ASC' },
    });

    return matches.map((m) => this._formatMatch(m));
  }

  async createMatch(dto: CreateChessMatchDto): Promise<any> {
    const round = await this.chessRoundRepo.findOne({
      where: { chessRoundId: dto.chessRoundId },
    });
    if (!round) {
      throw new NotFoundException(`ChessRound #${dto.chessRoundId} no encontrado`);
    }

    const [white, black] = await Promise.all([
      this.phaseRegRepo.findOne({
        where: {
          phaseRegistrationId: dto.whitePhaseRegistrationId,
          phaseId: round.phaseId,
        },
      }),
      this.phaseRegRepo.findOne({
        where: {
          phaseRegistrationId: dto.blackPhaseRegistrationId,
          phaseId: round.phaseId,
        },
      }),
    ]);

    if (!white) {
      throw new NotFoundException(
        `PhaseRegistration blancas #${dto.whitePhaseRegistrationId} no encontrado o no pertenece a esta fase`,
      );
    }
    if (!black) {
      throw new NotFoundException(
        `PhaseRegistration negras #${dto.blackPhaseRegistrationId} no encontrado o no pertenece a esta fase`,
      );
    }
    if (dto.whitePhaseRegistrationId === dto.blackPhaseRegistrationId) {
      throw new BadRequestException('Un jugador no puede enfrentarse a sí mismo');
    }

    const match = this.chessMatchRepo.create({
      chessRoundId: dto.chessRoundId,
      whitePhaseRegistrationId: dto.whitePhaseRegistrationId,
      blackPhaseRegistrationId: dto.blackPhaseRegistrationId,
      boardNumber: dto.boardNumber ?? null,
      notes: dto.notes ?? null,
      result: null,
    });

    const saved = await this.chessMatchRepo.save(match);
    return this.findOneMatch(saved.chessMatchId);
  }

  async updateMatch(id: number, dto: UpdateChessMatchDto): Promise<any> {
    const match = await this.chessMatchRepo.findOne({
      where: { chessMatchId: id },
    });
    if (!match) {
      throw new NotFoundException(`ChessMatch #${id} no encontrado`);
    }
    if (dto.result !== undefined) match.result = dto.result ?? null;
    if (dto.boardNumber !== undefined) match.boardNumber = dto.boardNumber ?? null;
    if (dto.notes !== undefined) match.notes = dto.notes ?? null;
    await this.chessMatchRepo.save(match);
    return this.findOneMatch(id);
  }

  async deleteMatch(id: number): Promise<{ deleted: boolean }> {
    const match = await this.chessMatchRepo.findOne({
      where: { chessMatchId: id },
    });
    if (!match) throw new NotFoundException(`ChessMatch #${id} no encontrado`);
    await this.chessMatchRepo.remove(match);
    return { deleted: true };
  }

  async findOneMatch(id: number): Promise<any> {
    const match = await this.chessMatchRepo.findOne({
      where: { chessMatchId: id },
      relations: [
        'whitePhaseRegistration',
        'whitePhaseRegistration.registration',
        'whitePhaseRegistration.registration.athlete',
        'whitePhaseRegistration.registration.athlete.institution',
        'whitePhaseRegistration.registration.team',
        'whitePhaseRegistration.registration.team.institution',
        'blackPhaseRegistration',
        'blackPhaseRegistration.registration',
        'blackPhaseRegistration.registration.athlete',
        'blackPhaseRegistration.registration.athlete.institution',
        'blackPhaseRegistration.registration.team',
        'blackPhaseRegistration.registration.team.institution',
      ],
    });
    if (!match) throw new NotFoundException(`ChessMatch #${id} no encontrado`);
    return this._formatMatch(match);
  }

  // ── TABLA COMPLETA por fase ───────────────────────────────────────

  async getFullTable(phaseId: number): Promise<any[]> {
    const rounds = await this.chessRoundRepo.find({
      where: { phaseId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    const result = await Promise.all(
      rounds.map(async (round) => ({
        chessRoundId: round.chessRoundId,
        name: round.name,
        sortOrder: round.sortOrder,
        matches: await this.getMatchesByRound(round.chessRoundId),
      })),
    );

    return result;
  }

  // ── STANDINGS / PUNTUACIÓN acumulada por fase ─────────────────────

  async getStandings(phaseId: number): Promise<any[]> {
    const rounds = await this.chessRoundRepo.find({
      where: { phaseId },
    });
    if (rounds.length === 0) return [];

    const roundIds = rounds.map((r) => r.chessRoundId);

    const matches = await this.chessMatchRepo.find({
      where: { chessRoundId: In(roundIds) },
      relations: [
        'whitePhaseRegistration',
        'whitePhaseRegistration.registration',
        'whitePhaseRegistration.registration.athlete',
        'whitePhaseRegistration.registration.athlete.institution',
        'whitePhaseRegistration.registration.team',
        'whitePhaseRegistration.registration.team.institution',
        'blackPhaseRegistration',
        'blackPhaseRegistration.registration',
        'blackPhaseRegistration.registration.athlete',
        'blackPhaseRegistration.registration.athlete.institution',
        'blackPhaseRegistration.registration.team',
        'blackPhaseRegistration.registration.team.institution',
      ],
    });

    // Acumular puntos: 1 victoria, 0.5 empate, 0 derrota
    const pointsMap = new Map<
      number,
      { phaseRegistrationId: number; name: string; institution: string; points: number; gamesPlayed: number }
    >();

    const ensurePlayer = (pr: PhaseRegistration) => {
      const id = pr.phaseRegistrationId;
      if (!pointsMap.has(id)) {
        const reg = (pr as any).registration;
        const athlete = reg?.athlete;
        const team = reg?.team;
        const institution = athlete?.institution ?? team?.institution;
        pointsMap.set(id, {
          phaseRegistrationId: id,
          name: athlete?.name ?? team?.name ?? `Registro ${pr.registrationId}`,
          institution: institution?.name ?? '',
          points: 0,
          gamesPlayed: 0,
        });
      }
      return pointsMap.get(id)!;
    };

    for (const m of matches) {
      const white = ensurePlayer(m.whitePhaseRegistration);
      const black = ensurePlayer(m.blackPhaseRegistration);

      if (m.result === '1-0') {
        white.points += 1;
        white.gamesPlayed += 1;
        black.gamesPlayed += 1;
      } else if (m.result === '0-1') {
        black.points += 1;
        white.gamesPlayed += 1;
        black.gamesPlayed += 1;
      } else if (m.result === '½-½') {
        white.points += 0.5;
        black.points += 0.5;
        white.gamesPlayed += 1;
        black.gamesPlayed += 1;
      }
      // si result es null → solo contar gamesPlayed si quieres partidas jugadas reales
    }

    return Array.from(pointsMap.values()).sort((a, b) => b.points - a.points);
  }

  // ── helper privado ────────────────────────────────────────────────

  private _formatMatch(m: ChessMatch): any {
    const formatPlayer = (pr: PhaseRegistration) => {
      const reg = (pr as any).registration;
      const athlete = reg?.athlete;
      const team = reg?.team;
      const institution = athlete?.institution ?? team?.institution;
      return {
        phaseRegistrationId: pr.phaseRegistrationId,
        name: athlete?.name ?? team?.name ?? `Registro ${pr.registrationId}`,
        institution: institution?.name ?? '',
      };
    };

    return {
      chessMatchId: m.chessMatchId,
      chessRoundId: m.chessRoundId,
      boardNumber: m.boardNumber,
      result: m.result,
      notes: m.notes,
      white: formatPlayer(m.whitePhaseRegistration),
      black: formatPlayer(m.blackPhaseRegistration),
    };
  }
}
