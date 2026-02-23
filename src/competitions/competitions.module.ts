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

import {
  Match,
  MatchGame,
  MatchLineup,
  Participation,
  Phase,
  Standing,
  IndividualScore,
  PhaseManualRank,
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
    ]),
  ],
  controllers: [
    CompetitionsController,
    TaekwondoPoomsaeController,
    TaekwondoKyoruguiController,
    JudoController,
    KarateController,
    WushuController,
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
  ],
  exports: [CompetitionsService, BracketService, TaekwondoPoomsaeService],
})
export class CompetitionsModule {}
