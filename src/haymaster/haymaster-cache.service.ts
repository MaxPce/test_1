import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { HaymasterService } from './haymaster.service';
import { SismasterPerson } from '../sismaster/entities/sismaster-person.entity';
import { SismasterInstitution } from '../sismaster/entities/sismaster-institution.entity';

@Injectable()
export class HaymasterCacheService {
  private readonly logger = new Logger(HaymasterCacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private haymasterService: HaymasterService,
  ) {}

  async getAthleteById(id: number): Promise<SismasterPerson | null> {
    if (!id) return null;
    const cacheKey = `hay:athlete:${id}`;   // ← prefijo 'hay:' para no colisionar con sismaster
    try {
      const cached = await this.cacheManager.get<SismasterPerson>(cacheKey);
      if (cached) return cached;
      const athlete = await this.haymasterService.getPersonById(id);
      if (!athlete) return null;
      await this.cacheManager.set(cacheKey, athlete, 3600000);
      return athlete;
    } catch (error) {
      this.logger.error(`Error getting haymaster athlete ${id}:`, error);
      return null;
    }
  }

  async getAthletesByIds(ids: number[]): Promise<SismasterPerson[]> {
    if (!ids || ids.length === 0) return [];
    const uniqueIds = [...new Set(ids)].filter((id) => id != null && id > 0);
    if (uniqueIds.length === 0) return [];
    const results = await Promise.all(uniqueIds.map((id) => this.getAthleteById(id)));
    return results.filter((a) => a !== null);
  }

  async getInstitutionById(id: number): Promise<SismasterInstitution | null> {
    if (!id) return null;
    const cacheKey = `hay:institution:${id}`;  // ← prefijo 'hay:'
    try {
      const cached = await this.cacheManager.get<SismasterInstitution>(cacheKey);
      if (cached) return cached;
      const institution = await this.haymasterService.getInstitutionById(id);
      if (!institution) return null;
      await this.cacheManager.set(cacheKey, institution, 7200000);
      return institution;
    } catch (error) {
      this.logger.error(`Error getting haymaster institution ${id}:`, error);
      return null;
    }
  }

  async getInstitutionsByIds(ids: number[]): Promise<SismasterInstitution[]> {
    if (!ids || ids.length === 0) return [];
    const uniqueIds = [...new Set(ids)].filter((id) => id != null && id > 0);
    if (uniqueIds.length === 0) return [];
    const results = await Promise.all(uniqueIds.map((id) => this.getInstitutionById(id)));
    return results.filter((inst) => inst !== null);
  }

  async invalidateAthlete(id: number): Promise<void> {
    await this.cacheManager.del(`hay:athlete:${id}`);
  }

  async invalidateInstitution(id: number): Promise<void> {
    await this.cacheManager.del(`hay:institution:${id}`);
  }
}