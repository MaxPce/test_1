import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeaturedAthlete } from '../entities/featured-athlete.entity';
import { CreateFeaturedAthleteDto } from '../dto/create-featured-athlete.dto';
import { UpdateFeaturedAthleteDto } from '../dto/update-featured-athlete.dto';
import { UpsertFeaturedAthleteByPhaseDto } from '../dto/upsert-featured-athlete-by-phase.dto';

@Injectable()
export class FeaturedAthletesService {
  constructor(
    @InjectRepository(FeaturedAthlete)
    private readonly repo: Repository<FeaturedAthlete>,
  ) {}

  async create(dto: CreateFeaturedAthleteDto): Promise<FeaturedAthlete> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findByEventCategory(eventCategoryId: number): Promise<FeaturedAthlete[]> {
    return this.repo.find({
      where: { eventCategoryId },
      relations: [
        'registration',
        'registration.athlete',
        'registration.athlete.institution',
        'registration.team',
      ],
    });
  }

  async update(id: number, dto: UpdateFeaturedAthleteDto): Promise<FeaturedAthlete> {
    const entity = await this.repo.findOne({ where: { featuredAthleteId: id } });
    if (!entity) throw new NotFoundException(`FeaturedAthlete #${id} not found`);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  async findByPhase(phaseId: number): Promise<FeaturedAthlete[]> {
  return this.repo.find({ // Cambiar de featuredAthleteRepo a repo
    where: { phaseId },
    relations: [
      'registration',
      'registration.athlete',
      'registration.athlete.institution', 
    ],
  });
}

async upsertByPhase(
  dto: UpsertFeaturedAthleteByPhaseDto,
): Promise<FeaturedAthlete> {
  const existing = await this.repo.findOne({ 
    where: { phaseId: dto.phaseId },
  });

  if (existing) {
    existing.registrationId = dto.registrationId;
    existing.reason = dto.reason ?? null;
    return this.repo.save(existing); 
  }

  return this.repo.save( 
    this.repo.create({ 
      phaseId: dto.phaseId,
      eventCategoryId: dto.eventCategoryId,
      registrationId: dto.registrationId,
      reason: dto.reason ?? null,
    }),
  );
}


  




}
