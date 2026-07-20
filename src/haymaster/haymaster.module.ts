import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { HaymasterService } from './haymaster.service';
import { HaymasterController } from './haymaster.controller';
import { HaymasterCacheService } from './haymaster-cache.service';
import { HaymasterEvent } from './entities/haymaster-event.entity';
import { HaymasterSportParam } from './entities/haymaster-sport-param.entity';
import { SismasterModule } from '../sismaster/sismaster.module'; // ← necesario para forwardRef
import {
  SismasterPerson,
  SismasterInstitution,
  SismasterSport,
  SismasterAccreditation,
  SismasterEventSport,
  SismasterSportParam,
} from '../sismaster/entities';
import { Event } from '../events/entities/event.entity';
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

@Module({
  imports: [
    forwardRef(() => SismasterModule), // ← primero y solo con forwardRef
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
      Event,
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
  providers: [HaymasterService, HaymasterCacheService], // sin CompetitionPhaseReportService
  exports: [HaymasterService, HaymasterCacheService],
})
export class HaymasterModule {}