// src/karate-medal-table/karate-medal-table.module.ts
import { Module } from '@nestjs/common';
import { KarateMedalTableService }    from './karate-medal-table.service';
import { KarateMedalTableController } from './karate-medal-table.controller';

@Module({
  controllers: [KarateMedalTableController],
  providers:   [KarateMedalTableService],
  exports:     [KarateMedalTableService],
})
export class KarateMedalTableModule {}