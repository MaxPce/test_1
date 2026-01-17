// src/competitions/competitions.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { TableTennisService } from './table-tennis.service';
import { TaekwondoKyoruguiService } from './taekwondo-kyorugui.service';
import { TaekwondoPoomsaeService } from './taekwondo-poomsae.service';
import { TaekwondoPoomsaeController } from './taekwondo-poomsae.controller';
import { TaekwondoKyoruguiController } from './taekwondo-kyorugui.controller';

import {
  Match,
  MatchGame,
  MatchLineup,
  Participation,
  Phase,
  Standing,
  IndividualScore,
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
      IndividualScore,
    ]),
  ],
  controllers: [
    CompetitionsController,
    TaekwondoPoomsaeController,
    TaekwondoKyoruguiController,
  ],
  providers: [
    CompetitionsService,
    TableTennisService,
    TaekwondoKyoruguiService,
    TaekwondoPoomsaeService,
  ],
  exports: [CompetitionsService],
})
export class CompetitionsModule {}
