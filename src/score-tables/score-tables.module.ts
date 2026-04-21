// src/score-tables/score-tables.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoreTable } from './entities/score-table.entity';
import { ScoreTablesService } from './score-tables.service';
import { ScoreTablesController } from './score-tables.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ScoreTable])],
  controllers: [ScoreTablesController],
  providers: [ScoreTablesService],
  exports: [ScoreTablesService],
})
export class ScoreTablesModule {}