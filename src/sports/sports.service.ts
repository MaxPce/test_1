import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SportType, Sport, Category } from './entities';
import {
  CreateSportTypeDto,
  UpdateSportTypeDto,
  CreateSportDto,
  UpdateSportDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';

@Injectable()
export class SportsService {
  constructor(
    @InjectRepository(SportType)
    private sportTypeRepository: Repository<SportType>,
    @InjectRepository(Sport)
    private sportRepository: Repository<Sport>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  // ==================== SPORT TYPES ====================

  async createSportType(createDto: CreateSportTypeDto): Promise<SportType> {
    const sportType = this.sportTypeRepository.create(createDto);
    return this.sportTypeRepository.save(sportType);
  }

  async findAllSportTypes(): Promise<SportType[]> {
    return this.sportTypeRepository.find({
      relations: ['sports'],
      order: { name: 'ASC' },
    });
  }

  async findOneSportType(id: number): Promise<SportType> {
    const sportType = await this.sportTypeRepository.findOne({
      where: { sportTypeId: id },
      relations: ['sports'],
    });

    if (!sportType) {
      throw new NotFoundException(`Tipo de deporte con ID ${id} no encontrado`);
    }

    return sportType;
  }

  async updateSportType(
    id: number,
    updateDto: UpdateSportTypeDto,
  ): Promise<SportType> {
    const sportType = await this.findOneSportType(id);
    Object.assign(sportType, updateDto);
    return this.sportTypeRepository.save(sportType);
  }

  async removeSportType(id: number): Promise<void> {
    const sportType = await this.findOneSportType(id);

    const sportsCount = await this.sportRepository.count({
      where: { sportTypeId: id, deletedAt: IsNull() },
    });

    if (sportsCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el tipo de deporte porque tiene ${sportsCount} deporte(s) asociado(s)`,
      );
    }

    await this.sportTypeRepository.remove(sportType);
  }

  // ==================== SPORTS ====================

  async createSport(createDto: CreateSportDto): Promise<Sport> {
    await this.findOneSportType(createDto.sportTypeId);

    const sport = this.sportRepository.create(createDto);
    return this.sportRepository.save(sport);
  }

  async findAllSports(sportTypeId?: number): Promise<Sport[]> {
    const where: any = { deletedAt: null };
    if (sportTypeId) {
      where.sportTypeId = sportTypeId;
    }

    return this.sportRepository.find({
      where,
      relations: ['sportType', 'categories'],
      order: { name: 'ASC' },
    });
  }

  async findOneSport(id: number): Promise<Sport> {
    const sport = await this.sportRepository.findOne({
      where: { sportId: id },
      relations: ['sportType', 'categories'],
      withDeleted: false,
    });

    if (!sport) {
      throw new NotFoundException(`Deporte con ID ${id} no encontrado`);
    }

    return sport;
  }

  async updateSport(id: number, updateDto: UpdateSportDto): Promise<Sport> {
    const sport = await this.findOneSport(id);

    if (updateDto.sportTypeId) {
      await this.findOneSportType(updateDto.sportTypeId);
    }

    Object.assign(sport, updateDto);
    return this.sportRepository.save(sport);
  }

  async removeSport(id: number, userId?: number): Promise<void> {
    const sport = await this.findOneSport(id);

    const categoriesCount = await this.categoryRepository.count({
      where: { sportId: id, deletedAt: IsNull() },
    });

    if (categoriesCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el deporte porque tiene ${categoriesCount} categoría(s) asociada(s)`,
      );
    }

    await this.sportRepository.softRemove(sport);

    if (userId) {
      await this.sportRepository.update(id, { deletedBy: userId });
    }
  }

  async restoreSport(id: number): Promise<Sport> {
    const sport = await this.sportRepository.findOne({
      where: { sportId: id },
      withDeleted: true,
    });

    if (!sport) {
      throw new NotFoundException(`Deporte con ID ${id} no encontrado`);
    }

    if (!sport.deletedAt) {
      throw new BadRequestException('El deporte no está eliminado');
    }

    await this.sportRepository.restore(id);
    await this.sportRepository
      .createQueryBuilder()
      .update()
      .set({ deletedBy: null } as any)
      .where('sportId = :id', { id })
      .execute();

    return this.findOneSport(id);
  }


  async findDeletedSports(): Promise<Sport[]> {
    return this.sportRepository
      .createQueryBuilder('sport')
      .leftJoinAndSelect('sport.sportType', 'sportType')
      .leftJoinAndSelect('sport.categories', 'categories')
      .where('sport.deletedAt IS NOT NULL')
      .withDeleted()
      .getMany();
  }

  async hardDeleteSport(id: number): Promise<void> {
    const sport = await this.sportRepository.findOne({
      where: { sportId: id },
      withDeleted: true,
    });

    if (!sport) {
      throw new NotFoundException(`Deporte con ID ${id} no encontrado`);
    }

    await this.sportRepository.remove(sport);
  }

  // ==================== CATEGORIES ====================

  async createCategory(createDto: CreateCategoryDto): Promise<Category> {
    if (createDto.sportId) {
      await this.findOneSport(createDto.sportId);
    }

    if (createDto.weightMin && createDto.weightMax) {
      if (createDto.weightMin >= createDto.weightMax) {
        throw new BadRequestException(
          'El peso mínimo debe ser menor al peso máximo',
        );
      }
    }

    const category = this.categoryRepository.create(createDto);
    return this.categoryRepository.save(category);
  }

  async findAllCategories(
    sportId?: number,
    formatType?: string,
  ): Promise<Category[]> {
    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.sport', 'sport')
      .where('category.deletedAt IS NULL');

    if (sportId) {
      queryBuilder.andWhere('category.sportId = :sportId', { sportId });
    }

    if (formatType) {
      queryBuilder.andWhere('category.formatType = :formatType', {
        formatType,
      });
    }

    return queryBuilder.orderBy('category.name', 'ASC').getMany();
  }

  async findOneCategory(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { categoryId: id },
      relations: ['sport'],
      withDeleted: false,
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return category;
  }

  async updateCategory(
    id: number,
    updateDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOneCategory(id);

    if (updateDto.sportId) {
      await this.findOneSport(updateDto.sportId);
    }

    const newWeightMin = updateDto.weightMin ?? category.weightMin;
    const newWeightMax = updateDto.weightMax ?? category.weightMax;

    if (newWeightMin && newWeightMax && newWeightMin >= newWeightMax) {
      throw new BadRequestException(
        'El peso mínimo debe ser menor al peso máximo',
      );
    }

    Object.assign(category, updateDto);
    return this.categoryRepository.save(category);
  }

  async removeCategory(id: number, userId?: number): Promise<void> {
    const category = await this.findOneCategory(id);

    await this.categoryRepository.softRemove(category);

    if (userId) {
      await this.categoryRepository.update(id, { deletedBy: userId });
    }
  }

  async restoreCategory(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { categoryId: id },
      withDeleted: true,
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    if (!category.deletedAt) {
      throw new BadRequestException('La categoría no está eliminada');
    }

    await this.categoryRepository.restore(id);
    await this.categoryRepository
      .createQueryBuilder()
      .update()
      .set({ deletedBy: null } as any)
      .where('categoryId = :id', { id })
      .execute();

    return this.findOneCategory(id);
  }


  async findDeletedCategories(): Promise<Category[]> {
    return this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.sport', 'sport')
      .where('category.deletedAt IS NOT NULL')
      .withDeleted()
      .getMany();
  }

  async hardDeleteCategory(id: number): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { categoryId: id },
      withDeleted: true,
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    await this.categoryRepository.remove(category);
  }
}
