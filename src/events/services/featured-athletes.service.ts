import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeaturedAthlete } from '../entities/featured-athlete.entity';
import { CreateFeaturedAthleteDto } from '../dto/create-featured-athlete.dto';
import { UpdateFeaturedAthleteDto } from '../dto/update-featured-athlete.dto';

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
}
