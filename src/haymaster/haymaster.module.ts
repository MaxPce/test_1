import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { HaymasterService } from './haymaster.service';
import { HaymasterController } from './haymaster.controller';
import { HaymasterCacheService } from './haymaster-cache.service';
import { HaymasterEvent } from './entities/haymaster-event.entity';
import { CompetitionPhaseReportService } from '../sismaster/competition-phase-report.service';
import { SismasterModule } from '../sismaster/sismaster.module';

import {
  SismasterPerson,          // ← SismasterEvent removido de aquí
  SismasterInstitution,
  SismasterSport,
  SismasterAccreditation,
  SismasterEventSport,
  SismasterSportParam,
} from '../sismaster/entities';

import { EventCategory } from '../events/entities/event-category.entity';
import { Registration } from '../events/entities/registration.entity';
import { Phase } from '../competitions/entities/phase.entity';
import { Match } from '../competitions/entities/match.entity';
import { Participation } from '../competitions/entities/participation.entity';
import { Standing } from '../competitions/entities/standing.entity';
import { PhaseManualRank } from '../competitions/entities/phase-manual-rank.entity';
import { MatchGame } from '../competitions/entities/match-game.entity';
import { Result } from '../results/entities/result.entity';
import {
  AthleticsResult,
  IndividualScore,
  PhaseRegistration,
  ShootingScore,
  WeightliftingAttempt,
} from 'src/competitions/entities';
import { AthleticsSection } from 'src/competitions/entities/athletics-section.entity';
import { AthleticsSectionEntry } from 'src/competitions/entities/athletics-section-entry.entity';
import { HaymasterSportParam } from './entities/haymaster-sport-param.entity';

@Module({
  imports: [
    SismasterModule,   // ← AQUÍ, fuera del TypeOrmModule.forFeature

    TypeOrmModule.forFeature(
      [
        
        HaymasterEvent,
        SismasterPerson,
        SismasterInstitution,
        SismasterSport,
        SismasterAccreditation,
        SismasterEventSport,
        HaymasterSportParam,
      ],
      'haymaster',
    ),
    TypeOrmModule.forFeature([
      EventCategory,
      Registration,
      Phase,
      Match,
      Participation,
      Standing,
      PhaseManualRank,
      PhaseRegistration,
      MatchGame,
      ShootingScore,
      IndividualScore,
      AthleticsSection,
      AthleticsSectionEntry,
      AthleticsResult,
      Result,
      WeightliftingAttempt,
    ]),
    CacheModule.register({ ttl: 600, max: 1000 }),
  ],
  controllers: [HaymasterController],
  providers: [HaymasterService, HaymasterCacheService, CompetitionPhaseReportService],
  exports: [HaymasterService, HaymasterCacheService],
})
export class HaymasterModule {}