// src/tennis-medal-table/tennis-medal-table.module.ts
import { Module } from '@nestjs/common';
import { TennisMedalTableService }    from './tennis-medal-table.service';
import { TennisMedalTableController } from './tennis-medal-table.controller';

@Module({
  controllers: [TennisMedalTableController],
  providers:   [TennisMedalTableService],
  exports:     [TennisMedalTableService],
})
export class TennisMedalTableModule {}