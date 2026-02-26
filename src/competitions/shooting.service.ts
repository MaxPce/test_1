import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShootingScore } from './entities/shooting-score.entity';
import { Participation } from './entities/participation.entity';
import { Phase } from './entities/phase.entity';
import { UpdateShootingScoreDto } from './dto/update-shooting-score.dto';

@Injectable()
export class ShootingService {
  constructor(
    @InjectRepository(ShootingScore)
    private readonly shootingScoreRepository: Repository<ShootingScore>,
    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,
    @InjectRepository(Phase)
    private readonly phaseRepository: Repository<Phase>,
  ) {}

  async updateShootingScore(
    participationId: number,
    updateDto: UpdateShootingScoreDto,
  ): Promise<ShootingScore> {
    const participation = await this.participationRepository.findOne({
      where: { participationId },
    });

    if (!participation) {
      throw new NotFoundException(`Participation ${participationId} no encontrada`);
    }

    const total = parseFloat(
      updateDto.series.reduce((sum, s) => sum + s, 0).toFixed(1),
    );

    let score = await this.shootingScoreRepository.findOne({
      where: { participationId },
    });

    if (score) {
      score.series = updateDto.series;
      score.total = total;
      score.dns = false;
    } else {
      score = this.shootingScoreRepository.create({
        participationId,
        series: updateDto.series,
        total,
        dns: false,
      });
    }

    await this.shootingScoreRepository.save(score);
    await this.recalculateRankings(participationId);

    return score;
  }

  async setDns(participationId: number): Promise<ShootingScore> {
    const participation = await this.participationRepository.findOne({
      where: { participationId },
    });

    if (!participation) {
      throw new NotFoundException(`Participation ${participationId} no encontrada`);
    }

    let score = await this.shootingScoreRepository.findOne({
      where: { participationId },
    });

    if (score) {
      score.dns = true;
      score.total = null;
      score.series = [];
    } else {
      score = this.shootingScoreRepository.create({
        participationId,
        dns: true,
        series: [],
        });
        score.total = null;
    }

    await this.shootingScoreRepository.save(score);
    return score;
  }

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

    const participations = phase.matches
      .flatMap((match) => match.participations || [])
      .filter((p) => {
        if (!p.registration) return false;
        if (p.registration.deletedAt) return false;
        if (p.registration.athlete?.deletedAt) return false;
        if (p.registration.team?.deletedAt) return false;
        return true;
      });

    if (participations.length === 0) return [];

    const scores = await this.shootingScoreRepository.find({
      where: participations.map((p) => ({ participationId: p.participationId })),
    });

    const results = participations.map((participation) => {
      const score = scores.find(
        (s) => s.participationId === participation.participationId,
      );

      const reg = participation.registration;
      const isTeam = !!reg?.team;
      const name = isTeam ? reg.team.name : reg?.athlete?.name || 'Sin nombre';
      const institution = isTeam ? reg.team.institution : reg?.athlete?.institution;
      const gender = isTeam ? 'Equipo' : reg?.athlete?.gender || '-';

      return {
        participationId: participation.participationId,
        participantName: name,
        isTeam,
        institution: institution?.name || 'Sin institución',
        institutionLogo: institution?.logoUrl || null,
        gender,
        series: score?.series || [],
        total: score?.total || null,
        dns: score?.dns || false,
        rank: score?.rank || null,
      };
    });

    

    return results;
  }

  async getParticipationScore(participationId: number): Promise<ShootingScore> {
    const score = await this.shootingScoreRepository.findOne({
      where: { participationId },
    });

    if (!score) {
      throw new NotFoundException(
        `Score para participación ${participationId} no encontrado`,
      );
    }

    return score;
  }

  private async recalculateRankings(participationId: number): Promise<void> {
    const participation = await this.participationRepository.findOne({
      where: { participationId },
      relations: ['match'],
    });

    if (!participation?.match) return;

    const phaseId = participation.match.phaseId;

    const participationsInPhase = await this.participationRepository.find({
      where: { match: { phaseId } },
      relations: ['match'],
    });

    const ids = participationsInPhase.map((p) => p.participationId);

    const scores = await this.shootingScoreRepository.find({
      where: ids.map((id) => ({ participationId: id })),
    });

    const sorted = scores
        .filter((s): s is ShootingScore & { total: number } => s.total != null && !s.dns)
        .sort((a, b) => b.total - a.total);

    for (let i = 0; i < sorted.length; i++) {
      await this.shootingScoreRepository.update(sorted[i].shootingScoreId, {
        rank: i + 1,
      });
    }
  }
}
