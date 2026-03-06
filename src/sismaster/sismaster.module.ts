import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { SismasterService } from './sismaster.service';
import { SismasterController } from './sismaster.controller';
import { SismasterCacheService } from './sismaster-cache.service';
import {
  SismasterEvent,
  SismasterPerson,
  SismasterInstitution,
  SismasterSport,
  SismasterAccreditation,
  SismasterEventSport,
  SismasterSportParam,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature( 
      [
        SismasterEvent,
        SismasterPerson,
        SismasterInstitution,
        SismasterSport,
        SismasterAccreditation,
        SismasterEventSport,
        SismasterSportParam,
      ],
      'sismaster',
    ),
    CacheModule.register({
      ttl: 600, 
      max: 1000,
    }),
  ],
  controllers: [SismasterController],
  providers: [SismasterService, SismasterCacheService],
  exports: [SismasterService, SismasterCacheService],
})
export class SismasterModule {}
