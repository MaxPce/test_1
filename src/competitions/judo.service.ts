// src/competitions/judo.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import { Phase } from './entities/phase.entity';
import { Participation } from './entities/participation.entity';
import { PhaseRegistration } from './entities/phase-registration.entity';
import { MatchStatus, PhaseType, Corner } from '../common/enums';
import { UpdateJudoScoreDto } from './dto/update-judo-score.dto';
import {
  GenerateKumitePhasesDto,
  KumitePhaseFormat,
} from './dto/generate-kumite-phases.dto';
import { BracketService } from './bracket.service';
import * as crypto from 'crypto';

// Mapeo formato string → PhaseType enum real
const FORMAT_TO_PHASE_TYPE: Record<KumitePhaseFormat, PhaseType> = {
  single_elimination: PhaseType.ELIMINACION,
  round_robin:        PhaseType.GRUPO,
  best_of_3:          PhaseType.MEJOR_DE_3,
};

@Injectable()
export class JudoService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,

    @InjectRepository(Phase)
    private readonly phaseRepository: Repository<Phase>,

    @InjectRepository(Participation)
    private readonly participationRepository: Repository<Participation>,

    @InjectRepository(PhaseRegistration)
    private readonly phaseRegistrationRepository: Repository<PhaseRegistration>,

    private readonly bracketService: BracketService,
  ) {}

  // ─── GENERACIÓN AUTOMÁTICA DE FASES ─────────────────────────────────────

  async generatePhases(dto: GenerateKumitePhasesDto): Promise<{
    created: number;
    phaseIds: number[];
  }> {
    const phaseIds: number[] = [];

    for (const group of dto.groups) {
      if (group.registrationIds.length === 0) continue;

      // 1. Crear la Phase con el PhaseType correcto
      const phase = this.phaseRepository.create({
        eventCategoryId: dto.eventCategoryId,
        name: group.name,
        type: FORMAT_TO_PHASE_TYPE[group.format],
      });
      const savedPhase = await this.phaseRepository.save(phase);
      phaseIds.push(savedPhase.phaseId);

      // 2. Guardar el pool de participantes en phase_registrations
      //    (misma tabla que usa GenerateBracketModal y AssignParticipantsModal)
      const phaseRegs = group.registrationIds.map((registrationId) =>
        this.phaseRegistrationRepository.create({
          phaseId: savedPhase.phaseId,
          registrationId,
        }),
      );
      await this.phaseRegistrationRepository.save(phaseRegs);

      // 3. Inicializar matches según el formato
      await this.initializeMatchesByFormat(
        savedPhase.phaseId,
        group.format,
        group.registrationIds,
      );
    }

    return { created: phaseIds.length, phaseIds };
  }

  private async initializeMatchesByFormat(
    phaseId: number,
    format: KumitePhaseFormat,
    registrationIds: number[],
  ): Promise<void> {
    switch (format) {
      case 'single_elimination': {
        const n = registrationIds.length;
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))));
        await this.bracketService.generateCompleteBracket({
          phaseId,
          registrationIds: [],
          bracketSize,
          includeThirdPlace: false,   
        });
        break;
      }


      case 'round_robin':
        await this.initializeRoundRobinMatches(phaseId, registrationIds);
        break;

      case 'best_of_3':
        await this.initializeBestOf3Matches(phaseId, registrationIds);
        break;
    }
  }

  /**
   * Round Robin: genera N*(N-1)/2 matches sin participantes asignados.
   * El operador los asigna manualmente usando AssignParticipantsModal.
   */
  private async initializeRoundRobinMatches(
    phaseId: number,
    registrationIds: number[],
  ): Promise<void> {
    const n = registrationIds.length;
    let matchNumber = 1;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        await this.matchRepository.save(
          this.matchRepository.create({
            phaseId,
            matchNumber: matchNumber++,
            round: 'grupo',
            status: MatchStatus.PROGRAMADO,
          }),
        );
      }
    }
  }

  /**
   * Mejor de 3: exactamente 3 matches, con los 2 participantes
   * ya asignados directamente (solo aplica con 2 atletas en la fase).
   */
  private async initializeBestOf3Matches(
    phaseId: number,
    registrationIds: number[],
  ): Promise<void> {
    const seriesId = crypto.randomUUID();

    for (let seriesMatchNumber = 1; seriesMatchNumber <= 3; seriesMatchNumber++) {
      const match = await this.matchRepository.save(
        this.matchRepository.create({
          phaseId,
          matchNumber: seriesMatchNumber,
          round: 'serie',
          status: MatchStatus.PROGRAMADO,
          seriesId,
          seriesMatchNumber,
        }),
      );

      // Asignar directamente los 2 participantes a cada match de la serie
      const corners: Corner[] = [Corner.BLUE, Corner.WHITE];
      for (let idx = 0; idx < Math.min(registrationIds.length, 2); idx++) {
        await this.participationRepository.save(
          this.participationRepository.create({
            matchId: match.matchId,
            registrationId: registrationIds[idx],
            corner: corners[idx],
          }),
        );
      }
    }
  }

  // ─── MÉTODOS EXISTENTES ──────────────────────────────────────────────────

  async updateMatchScore(
    matchId: number,
    updateDto: UpdateJudoScoreDto,
  ): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: ['participations', 'participations.registration'],
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    match.participant1Score = updateDto.participant1Score;
    match.participant2Score = updateDto.participant2Score;

    if (updateDto.participant1Score > updateDto.participant2Score) {
      const regId = match.participations[0]?.registrationId;
      match.winnerRegistrationId = regId !== null ? regId : undefined;
    } else if (updateDto.participant2Score > updateDto.participant1Score) {
      const regId = match.participations[1]?.registrationId;
      match.winnerRegistrationId = regId !== null ? regId : undefined;
    }

    if (updateDto.winnerRegistrationId) {
      match.winnerRegistrationId = updateDto.winnerRegistrationId;
    }

    if (match.winnerRegistrationId) {
      match.status = MatchStatus.FINALIZADO;
    }

    return await this.matchRepository.save(match);
  }

  async getBracketWithScores(phaseId: number): Promise<Match[]> {
    return await this.matchRepository.find({
      where: { phaseId },
      relations: ['participations', 'participations.registration', 'winner'],
      order: { matchNumber: 'ASC' },
    });
  }

  async getMatchDetails(matchId: number): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { matchId },
      relations: [
        'participations',
        'participations.registration',
        'participations.registration.athlete',
        'winner',
      ],
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} no encontrado`);
    }

    return match;
  }
}