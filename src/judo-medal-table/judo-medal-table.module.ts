// src/judo-medal-table/judo-medal-table.module.ts
import { Module } from '@nestjs/common';
import { JudoMedalTableService }    from './judo-medal-table.service';
import { JudoMedalTableController } from './judo-medal-table.controller';

@Module({
  controllers: [JudoMedalTableController],
  providers:   [JudoMedalTableService],
  exports:     [JudoMedalTableService],
})
export class JudoMedalTableModule {}