// src/competitions/taekwondo-poomsae.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndividualScore } from './entities/individual-score.entity';
import { Participation } from './entities/participation.entity';
import { Phase } from './entities/phase.entity';
import { UpdatePoomsaeScoreDto } from './dto/update-poomsae-score.dto';

@Injectable()
export class TaekwondoPoomsaeService {
  constructor(
    @InjectRepository(IndividualScore)
    private readonly individualScoreRepository: Repository<IndividualScore>,
    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,
    @InjectRepository(Phase)
    private readonly phaseRepository: Repository<Phase>,
  ) {}

  async updatePoomsaeScore(
    participationId: number,
    updateDto: UpdatePoomsaeScoreDto,
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
    await this.recalculateRankings(participation.matchId);

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
      ],
    });

    if (!phase) {
      throw new NotFoundException(`Phase ${phaseId} no encontrada`);
    }

    // ✅ Obtener participaciones (ya deberían existir si se creó la fase correctamente)
    const participations = phase.matches
      .flatMap((match) => match.participations || [])
      .filter((p) => p !== null);

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
      const athlete = participation.registration?.athlete;

      return {
        participationId: participation.participationId,
        athleteName: athlete?.name || 'Sin nombre',
        institution: athlete?.institution?.name || 'Sin institución',
        gender: athlete?.gender || '-',
        accuracy: score?.accuracy || null,
        presentation: score?.presentation || null,
        total: score?.total || null,
        rank: score?.rank || null,
      };
    });

    results.sort((a, b) => {
      if (a.total === null) return 1;
      if (b.total === null) return -1;
      return b.total - a.total;
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
