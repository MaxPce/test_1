import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { SismasterService } from './sismaster.service';
import { SismasterPerson } from './entities/sismaster-person.entity';
import { SismasterInstitution } from './entities/sismaster-institution.entity';

@Injectable()
export class SismasterCacheService {
  private readonly logger = new Logger(SismasterCacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private sismasterService: SismasterService,
  ) {}

  /**
   * Obtener atleta por ID con caché
   * TTL: 1 hora (3600 segundos)
   */
  async getAthleteById(id: number): Promise<SismasterPerson | null> {
    if (!id) return null;

    const cacheKey = `athlete:${id}`;

    try {
      // 1. Intentar obtener del caché
      const cachedAthlete = await this.cacheManager.get<SismasterPerson>(cacheKey);

      if (cachedAthlete) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return cachedAthlete;
      }

      // 2. Si no está en caché, consultar DB
      this.logger.debug(`Cache MISS: ${cacheKey}`);
      const athlete = await this.sismasterService.getPersonById(id);

      if (!athlete) {
        this.logger.warn(`Athlete ${id} not found in sismaster`);
        return null;
      }

      // 3. Guardar en caché por 1 hora
      await this.cacheManager.set(cacheKey, athlete, 3600000); // 1 hora en ms

      return athlete;
    } catch (error) {
      this.logger.error(`Error getting athlete ${id}:`, error);
      return null;
    }
  }

  /**
   * Obtener múltiples atletas por IDs (batch loading)
   * Optimizado para evitar N+1 queries
   */
  async getAthletesByIds(ids: number[]): Promise<SismasterPerson[]> {
    if (!ids || ids.length === 0) return [];

    // Filtrar IDs únicos y válidos
    const uniqueIds = [...new Set(ids)].filter((id) => id != null && id > 0);

    if (uniqueIds.length === 0) return [];

    try {
      // 1. Intentar obtener todos del caché
      const cachePromises = uniqueIds.map((id) => this.getAthleteById(id));
      const cachedResults = await Promise.all(cachePromises);

      // Filtrar nulls
      return cachedResults.filter((athlete) => athlete !== null);
    } catch (error) {
      this.logger.error('Error in batch loading athletes:', error);
      return [];
    }
  }

  /**
   * Obtener institución por ID con caché
   * TTL: 2 horas (7200 segundos) - Las instituciones cambian menos
   */
  async getInstitutionById(id: number): Promise<SismasterInstitution | null> {
    if (!id) return null;

    const cacheKey = `institution:${id}`;

    try {
      const cachedInstitution = await this.cacheManager.get<SismasterInstitution>(cacheKey);

      if (cachedInstitution) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return cachedInstitution;
      }

      this.logger.debug(`Cache MISS: ${cacheKey}`);
      const institution = await this.sismasterService.getInstitutionById(id);

      if (!institution) {
        this.logger.warn(`Institution ${id} not found in sismaster`);
        return null;
      }

      await this.cacheManager.set(cacheKey, institution, 7200000); // 2 horas en ms

      return institution;
    } catch (error) {
      this.logger.error(`Error getting institution ${id}:`, error);
      return null;
    }
  }

  /**
   * Obtener múltiples instituciones por IDs
   */
  async getInstitutionsByIds(ids: number[]): Promise<SismasterInstitution[]> {
    if (!ids || ids.length === 0) return [];

    const uniqueIds = [...new Set(ids)].filter((id) => id != null && id > 0);

    if (uniqueIds.length === 0) return [];

    try {
      const cachePromises = uniqueIds.map((id) => this.getInstitutionById(id));
      const cachedResults = await Promise.all(cachePromises);

      return cachedResults.filter((inst) => inst !== null);
    } catch (error) {
      this.logger.error('Error in batch loading institutions:', error);
      return [];
    }
  }

  /**
   * Invalidar caché de un atleta específico
   */
  async invalidateAthlete(id: number): Promise<void> {
    await this.cacheManager.del(`athlete:${id}`);
    this.logger.log(`Cache invalidated: athlete:${id}`);
  }

  /**
   * Invalidar caché de una institución
   */
  async invalidateInstitution(id: number): Promise<void> {
    await this.cacheManager.del(`institution:${id}`);
    this.logger.log(`Cache invalidated: institution:${id}`);
  }

  /**
   * Limpiar todo el caché (usar con precaución)
   */
  async clearAll(): Promise<void> {
    // Nota: cache-manager v5 no tiene reset(), usar store.clear() si es necesario
    this.logger.warn('Clear all cache not implemented - delete keys individually');
  }
}
