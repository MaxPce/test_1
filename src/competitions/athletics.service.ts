import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AthleticsResult } from './entities/athletics-result.entity';
import { PhaseRegistration } from './entities/phase-registration.entity';
import { CreateAthleticsResultDto } from './dto/create-athletics-result.dto';
import { UpdateAthleticsResultDto } from './dto/update-athletics-result.dto';

@Injectable()
export class AthleticsService {
  constructor(
    @InjectRepository(AthleticsResult)
    private readonly athleticsResultRepo: Repository<AthleticsResult>,

    @InjectRepository(PhaseRegistration)
    private readonly phaseRegistrationRepo: Repository<PhaseRegistration>,
  ) {}

  // ── Crear resultado / intento ─────────────────────────────────────
  async create(dto: CreateAthleticsResultDto): Promise<AthleticsResult> {
    const phaseReg = await this.phaseRegistrationRepo.findOne({
      where: { phaseRegistrationId: dto.phaseRegistrationId },
    });
    if (!phaseReg) {
      throw new NotFoundException(
        `PhaseRegistration #${dto.phaseRegistrationId} no encontrado`,
      );
    }

    // Evitar intentos duplicados en saltos/lanzamientos
    if (dto.attemptNumber != null) {
      const existing = await this.athleticsResultRepo.findOne({
        where: {
          phaseRegistrationId: dto.phaseRegistrationId,
          attemptNumber: dto.attemptNumber,
          combinedEvent: dto.combinedEvent ?? null,
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Ya existe intento #${dto.attemptNumber} para este registro${dto.combinedEvent ? ` en ${dto.combinedEvent}` : ''}`,
        );
      }
    }

    const result = this.athleticsResultRepo.create(dto);
    return this.athleticsResultRepo.save(result);
  }

  // ── Todos los intentos de un phase_registration ───────────────────
  async findByPhaseRegistration(
    phaseRegistrationId: number,
  ): Promise<AthleticsResult[]> {
    return this.athleticsResultRepo.find({
      where: { phaseRegistrationId },
      order: { attemptNumber: 'ASC', combinedEvent: 'ASC', createdAt: 'ASC' },
    });
  }

  // ── Todos los resultados de una fase (ranking completo) ───────────
  async findByPhase(phaseId: number): Promise<AthleticsResult[]> {
    return this.athleticsResultRepo
      .createQueryBuilder('ar')
      .innerJoin('ar.phaseRegistration', 'pr')
      .innerJoin('pr.phase', 'ph')
      .innerJoin('pr.registration', 'reg')
      .leftJoin('reg.participant', 'participant')
      .where('ph.phaseId = :phaseId', { phaseId })
      .select([
        'ar',
        'pr.phaseRegistrationId',
        'pr.registrationId',
        'reg.registrationId',
        'participant',
      ])
      .orderBy('ar.phaseRegistrationId', 'ASC')
      .addOrderBy('ar.attemptNumber', 'ASC')
      .getMany();
  }

  // ── Ranking carreras por sección ──────────────────────────────────
  async getRankingTrack(
    phaseId: number,
    section?: string,
  ): Promise<AthleticsResult[]> {
    const qb = this.athleticsResultRepo
      .createQueryBuilder('ar')
      .innerJoin('ar.phaseRegistration', 'pr')
      .innerJoin('pr.phase', 'ph')
      .where('ph.phaseId = :phaseId', { phaseId })
      .andWhere('ar.time IS NOT NULL');

    if (section) {
      qb.andWhere('ar.section = :section', { section });
    }

    return qb
      .orderBy('ar.section', 'ASC')
      .addOrderBy('ar.time', 'ASC')
      .getMany();
  }

  // ── Ranking saltos/lanzamientos (mejor intento válido) ────────────
  async getRankingField(phaseId: number): Promise<AthleticsResult[]> {
    const results = await this.athleticsResultRepo
      .createQueryBuilder('ar')
      .innerJoin('ar.phaseRegistration', 'pr')
      .innerJoin('pr.phase', 'ph')
      .where('ph.phaseId = :phaseId', { phaseId })
      .andWhere('ar.distance_value IS NOT NULL')
      .andWhere('ar.is_valid = 1')
      .getMany();

    const grouped = new Map<number, AthleticsResult>();
    for (const r of results) {
      const current = grouped.get(r.phaseRegistrationId);
      if (!current || Number(r.distanceValue) > Number(current.distanceValue)) {
        grouped.set(r.phaseRegistrationId, r);
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) => Number(b.distanceValue) - Number(a.distanceValue),
    );
  }

  // ── Uno por id ────────────────────────────────────────────────────
  async findOne(id: number): Promise<AthleticsResult> {
    const result = await this.athleticsResultRepo.findOne({
      where: { athleticsResultId: id },
      relations: ['phaseRegistration'],
    });
    if (!result) {
      throw new NotFoundException(`AthleticsResult #${id} no encontrado`);
    }
    return result;
  }

  // ── Actualizar ────────────────────────────────────────────────────
  async update(
    id: number,
    dto: UpdateAthleticsResultDto,
  ): Promise<AthleticsResult> {
    const result = await this.findOne(id);
    Object.assign(result, dto);
    return this.athleticsResultRepo.save(result);
  }

  // ── Eliminar uno ──────────────────────────────────────────────────
  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const result = await this.findOne(id);
    await this.athleticsResultRepo.remove(result);
    return { deleted: true, id };
  }

  // ── Reset: borrar todos los intentos de un registro ───────────────
  async resetPhaseRegistration(
    phaseRegistrationId: number,
  ): Promise<{ deleted: number }> {
    const results = await this.findByPhaseRegistration(phaseRegistrationId);
    await this.athleticsResultRepo.remove(results);
    return { deleted: results.length };
  }
}
