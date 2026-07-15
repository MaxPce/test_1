// src/weightlifting-medal-table/weightlifting-medal-table.module.ts
import { Module } from '@nestjs/common';
import { WeightliftingMedalTableService }    from './weightlifting-medal-table.service';
import { WeightliftingMedalTableController } from './weightlifting-medal-table.controller';

@Module({
  controllers: [WeightliftingMedalTableController],
  providers:   [WeightliftingMedalTableService],
  exports:     [WeightliftingMedalTableService],
})
export class WeightliftingMedalTableModule {}