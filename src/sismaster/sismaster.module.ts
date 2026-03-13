import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { SismasterService } from './sismaster.service';
import { SismasterController } from './sismaster.controller';
import { SismasterCacheService } from './sismaster-cache.service';
import { CompetitionSnapshotService } from './competition-snapshot.service';
import {
  SismasterEvent,
  SismasterPerson,
  SismasterInstitution,
  SismasterSport,
  SismasterAccreditation,
  SismasterEventSport,
  SismasterSportParam,
} from './entities';

import { Event } from '../events/entities/event.entity';
import { EventCategory } from '../events/entities/event-category.entity';
import { Registration } from '../events/entities/registration.entity';
import { Phase } from '../competitions/entities/phase.entity';
import { Match } from '../competitions/entities/match.entity';
import { Participation } from '../competitions/entities/participation.entity';
import { Standing } from '../competitions/entities/standing.entity';
import { PhaseManualRank } from '../competitions/entities/phase-manual-rank.entity';
import { MatchGame } from '../competitions/entities/match-game.entity';

import { CompetitionPhaseReportService } from './competition-phase-report.service';
import { IndividualScore, PhaseRegistration, ShootingScore } from 'src/competitions/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [ SismasterEvent, SismasterPerson, SismasterInstitution,
        SismasterSport, SismasterAccreditation, SismasterEventSport, SismasterSportParam ],
      'sismaster',
    ),
    TypeOrmModule.forFeature([
      EventCategory, Registration,
      Phase, Match, Participation, Standing, PhaseManualRank,PhaseRegistration,MatchGame, ShootingScore,IndividualScore
    ]),
    CacheModule.register({ ttl: 600, max: 1000 }),
  ],
  controllers: [SismasterController],
  providers: [SismasterService, SismasterCacheService,CompetitionSnapshotService,CompetitionPhaseReportService,],
  exports: [SismasterService, SismasterCacheService,CompetitionSnapshotService,CompetitionPhaseReportService,],
})
export class SismasterModule {}
