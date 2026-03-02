import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ClimbingScore } from './entities/climbing-score.entity';
import { Participation } from './entities/participation.entity';
import { Match } from './entities/match.entity';
import { Phase } from './entities/phase.entity';
import { MatchStatus } from '../common/enums';

// Tabla de puntos posicionales (FASU / formato imagen)
export const CLIMBING_POINTS_TABLE: Record<number, number> = {
  1: 100,
  2: 80,
  3: 65,
  4: 55,
  5: 51,
  6: 47,
  7: 43,
  8: 40,
  9: 37,
  10: 34,
  11: 31,
  12: 28,
  13: 26,
  14: 24,
  15: 22,
  16: 20,
  17: 18,
  18: 16,
  19: 14,
  20: 12,
};

function getPointsForRank(rank: number): number {
  return CLIMBING_POINTS_TABLE[rank] ?? Math.max(0, 10 - (rank - 21));
}

export class UpdateClimbingScoreDto {
  result?: number | null;
  rank?: number | null;
  notes?: string | null;
}

@Injectable()
export class ClimbingService {
  constructor(
    @InjectRepository(ClimbingScore)
    private climbingScoreRepository: Repository<ClimbingScore>,
    @InjectRepository(Participation)
    private participationRepository: Repository<Participation>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Phase)
    private phaseRepository: Repository<Phase>,
    private dataSource: DataSource,
  ) {}

  /**
   * Obtener tabla de scores de una fase
   */
  async getPhaseScores(phaseId: number) {
    const participations = await this.participationRepository.find({
      where: { match: { phaseId } } as any,
      relations: [
        'match',
        'registration',
        'registration.athlete',
        'registration.athlete.institution',
        'registration.team',
        'registration.team.institution',
        'climbingScore',
      ],
    });

    // Filtrar solo participaciones de esta fase
    const phaseParticipations = participations.filter(
      (p) => p.match?.phaseId === phaseId,
    );

    return phaseParticipations.map((p) => {
      const isTeam = !!p.registration?.team;
      const athlete = p.registration?.athlete;
      const team = p.registration?.team;
      const institution = athlete?.institution ?? team?.institution;

      return {
        participationId: p.participationId,
        registrationId: p.registrationId,
        participantName: isTeam
          ? (team?.name ?? 'Equipo')
          : (athlete?.name ?? 'Atleta'),
        participantPhoto: athlete?.photoUrl ?? null,
        institution: institution?.name ?? null,
        institutionAbrev: institution?.abrev ?? null,
        institutionLogo: institution?.logoUrl ?? null,
        isTeam,
        result: p.climbingScore?.result ?? null,
        rank: p.climbingScore?.rank ?? null,
        points: p.climbingScore?.points ?? null,
        notes: p.climbingScore?.notes ?? null,
      };
    });
  }

  /**
   * Actualizar score de una participación
   * Si se envía rank, calcula automáticamente los puntos posicionales
   */
  async updateScore(participationId: number, dto: UpdateClimbingScoreDto) {
    const participation = await this.participationRepository.findOne({
      where: { participationId },
    });

    if (!participation) {
      throw new NotFoundException('Participación no encontrada');
    }

    let score = await this.climbingScoreRepository.findOne({
      where: { participationId },
    });

    if (!score) {
      score = this.climbingScoreRepository.create({ participationId });
    }

    if (dto.result !== undefined) score.result = dto.result;
    if (dto.notes !== undefined) score.notes = dto.notes;

    // Si viene rank, calcular puntos automáticamente
    if (dto.rank !== undefined && dto.rank !== null) {
      score.rank = dto.rank;
      score.points = getPointsForRank(dto.rank);
    } else if (dto.rank === null) {
      score.rank = null;
      score.points = null;
    }

    return this.climbingScoreRepository.save(score);
  }

  /**
   * Obtener score de una participación específica
   */
  async getParticipationScore(participationId: number) {
    const score = await this.climbingScoreRepository.findOne({
      where: { participationId },
      relations: ['participation', 'participation.registration'],
    });

    if (!score) {
      throw new NotFoundException('Score no encontrado');
    }

    return score;
  }

  /**
   * Ranking institucional: agrupa por institución y suma puntos
   * Soporta filtro por género si eventCategoryId y gender se pasan desde el frontend
   */
  async getInstitutionalRanking(phaseId: number): Promise<{
    general: {
      institutionName: string;
      institutionAbrev: string;
      logoUrl: string | null;
      totalPoints: number;
    }[];
  }> {
    const scores = await this.getPhaseScores(phaseId);

    const institutionMap = new Map<
      string,
      {
        institutionName: string;
        institutionAbrev: string;
        logoUrl: string | null;
        totalPoints: number;
      }
    >();

    for (const s of scores) {
      if (!s.institution || !s.points) continue;

      const key = s.institution;
      if (!institutionMap.has(key)) {
        institutionMap.set(key, {
          institutionName: s.institution,
          institutionAbrev: s.institutionAbrev ?? s.institution,
          logoUrl: s.institutionLogo ?? null,
          totalPoints: 0,
        });
      }
      institutionMap.get(key)!.totalPoints += s.points;
    }

    const general = Array.from(institutionMap.values()).sort(
      (a, b) => b.totalPoints - a.totalPoints,
    );

    return { general };
  }

  /**
   * Tabla de puntos posicionales (para mostrar en el frontend)
   */
  getPointsTable() {
    return Object.entries(CLIMBING_POINTS_TABLE).map(([rank, points]) => ({
      rank: Number(rank),
      points,
    }));
  }
}
