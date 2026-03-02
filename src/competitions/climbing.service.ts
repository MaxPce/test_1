import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndividualScore } from './entities/individual-score.entity';
import { Participation } from './entities/participation.entity';
import { Phase } from './entities/phase.entity';
import { UpdateClimbingScoreDto } from './dto/update-climbing-score.dto';

@Injectable()
export class ClimbingService {
  constructor(
    @InjectRepository(IndividualScore)
    private readonly individualScoreRepository: Repository<IndividualScore>,
    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,
    @InjectRepository(Phase)
    private readonly phaseRepository: Repository<Phase>,
  ) {}

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

    if (!phase) throw new NotFoundException(`Phase ${phaseId} no encontrada`);

    const participations = phase.matches
      .flatMap((m) => m.participations || [])
      .filter((p) => {
        if (!p.registration) return false;
        if (p.registration.deletedAt) return false;
        if (p.registration.athlete?.deletedAt) return false;
        if (p.registration.team?.deletedAt) return false;
        return true;
      });

    if (participations.length === 0) return [];

    const scores = await this.individualScoreRepository.find({
      where: participations.map((p) => ({
        participationId: p.participationId,
      })),
    });

    return participations.map((p, index) => {
      const score = scores.find((s) => s.participationId === p.participationId);
      const isTeam = !!p.registration?.team;
      const athlete = p.registration?.athlete;
      const team = p.registration?.team;
      const institution = athlete?.institution ?? team?.institution;

      return {
        rowNumber: index + 1,
        participationId: p.participationId,
        registrationId: p.registrationId,
        participantName: isTeam
          ? (team?.name ?? 'Equipo')
          : (athlete?.name ?? 'Atleta'),
        participantPhoto: athlete?.photoUrl ?? null,
        institution: institution?.name ?? null,
        institutionAbrev: institution?.abrev ?? null,
        isTeam,
        total: score?.total ?? null,
        rank: score?.rank ?? null,
      };
    });
  }

  async updateScore(participationId: number, dto: UpdateClimbingScoreDto) {
    const participation = await this.participationRepository.findOne({
      where: { participationId },
    });

    if (!participation) {
      throw new NotFoundException('Participación no encontrada');
    }

    let score = await this.individualScoreRepository.findOne({
      where: { participationId },
    });

    if (!score) {
      score = this.individualScoreRepository.create({
        participationId: participationId,
      });
    }

    if (dto.total !== undefined) (score as any).total = dto.total;
    if (dto.rank !== undefined) (score as any).rank = dto.rank;

    return this.individualScoreRepository.save(score);
  }
}
