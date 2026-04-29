// src/swimming-medal-table/swimming-medal-table.module.ts
import { Module } from '@nestjs/common';
import { SwimmingMedalTableController } from './swimming-medal-table.controller';
import { SwimmingMedalTableService } from './swimming-medal-table.service';

@Module({
  controllers: [SwimmingMedalTableController],
  providers: [SwimmingMedalTableService],
})
export class SwimmingMedalTableModule {}