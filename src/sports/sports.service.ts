import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    // Verificar si tiene deportes asociados
    const sportsCount = await this.sportRepository.count({
      where: { sportTypeId: id },
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
    // Verificar que el sport type existe
    await this.findOneSportType(createDto.sportTypeId);

    const sport = this.sportRepository.create(createDto);
    return this.sportRepository.save(sport);
  }

  async findAllSports(sportTypeId?: number): Promise<Sport[]> {
    const where = sportTypeId ? { sportTypeId } : {};

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

  async removeSport(id: number): Promise<void> {
    const sport = await this.findOneSport(id);

    // Verificar si tiene categorías asociadas
    const categoriesCount = await this.categoryRepository.count({
      where: { sportId: id },
    });

    if (categoriesCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el deporte porque tiene ${categoriesCount} categoría(s) asociada(s)`,
      );
    }

    await this.sportRepository.remove(sport);
  }

  // ==================== CATEGORIES ====================

  async createCategory(createDto: CreateCategoryDto): Promise<Category> {
    // Verificar que el deporte existe si se proporciona
    if (createDto.sportId) {
      await this.findOneSport(createDto.sportId);
    }

    // Validar rangos de peso
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
      .leftJoinAndSelect('category.sport', 'sport');

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

    // Validar rangos de peso si se actualizan
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

  async removeCategory(id: number): Promise<void> {
    const category = await this.findOneCategory(id);
    await this.categoryRepository.remove(category);
  }
}
