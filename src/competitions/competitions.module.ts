// src/competitions/competitions.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import {
  Phase,
  Match,
  Participation,
  Standing,
  MatchLineup,
  MatchGame,
} from './entities';
import { TableTennisService } from './table-tennis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Phase,
      Match,
      Participation,
      Standing,
      MatchLineup,
      MatchGame,
    ]),
  ],
  controllers: [CompetitionsController],
  providers: [CompetitionsService, TableTennisService],
  exports: [CompetitionsService, TableTennisService],
})
export class CompetitionsModule {}
