// src/wushu-medal-table/wushu-medal-table.module.ts
import { Module } from '@nestjs/common';
import { WushuMedalTableService }    from './wushu-medal-table.service';
import { WushuMedalTableController } from './wushu-medal-table.controller';

@Module({
  controllers: [WushuMedalTableController],
  providers:   [WushuMedalTableService],
  exports:     [WushuMedalTableService],
})
export class WushuMedalTableModule {}