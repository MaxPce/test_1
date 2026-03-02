import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { TableTennisService } from './table-tennis.service';
import { TaekwondoKyoruguiService } from './taekwondo-kyorugui.service';
import { TaekwondoPoomsaeService } from './taekwondo-poomsae.service';
import { TaekwondoPoomsaeController } from './taekwondo-poomsae.controller';
import { TaekwondoKyoruguiController } from './taekwondo-kyorugui.controller';
import { JudoController } from './judo.controller';
import { JudoService } from './judo.service';
import { BracketService } from './bracket.service';
import { Registration } from '../events/entities/registration.entity';
import { KarateController } from './karate.controller';
import { KarateService } from './karate.service';
import { WushuController } from './wushu.controller';
import { WushuService } from './wushu.service';
import { WushuTaoluController } from './wushu-taolu.controller';
import { WushuTaoluService } from './wushu-taolu.service';
import { ShootingController } from './shooting.controller';
import { ShootingService } from './shooting.service';
import { ShootingScore } from './entities/shooting-score.entity';
import { WeightliftingController } from './weightlifting.controller';
import { WeightliftingService } from './weightlifting.service';
import { WeightliftingAttempt } from './entities/weightlifting-attempt.entity';
import { ClimbingController } from './climbing.controller';
import { ClimbingService } from './climbing.service';
import { ClimbingScore } from './entities/climbing-score.entity';

import {
  Match,
  MatchGame,
  MatchLineup,
  Participation,
  Phase,
  Standing,
  IndividualScore,
  PhaseManualRank,
  PhaseRegistration,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Match,
      MatchGame,
      MatchLineup,
      Participation,
      Phase,
      Standing,
      Registration,
      IndividualScore,
      PhaseManualRank,
      PhaseRegistration,
      ShootingScore,
      WeightliftingAttempt,
      ClimbingScore,
    ]),
  ],
  controllers: [
    CompetitionsController,
    TaekwondoPoomsaeController,
    TaekwondoKyoruguiController,
    JudoController,
    KarateController,
    WushuController,
    WushuTaoluController,
    ShootingController,
    WeightliftingController,
    ClimbingController,
  ],
  providers: [
    CompetitionsService,
    TableTennisService,
    TaekwondoKyoruguiService,
    TaekwondoPoomsaeService,
    JudoService,
    BracketService,
    KarateService,
    WushuService,
    WushuTaoluService,
    ShootingService,
    WeightliftingService,
    ClimbingService,
  ],
  exports: [
    CompetitionsService,
    BracketService,
    TaekwondoPoomsaeService,
    WushuTaoluService,
    ShootingService,
    WeightliftingService,
    ClimbingService,
  ],
})
export class CompetitionsModule {}
