// src/taekwondo-kyorugui-medal-table/taekwondo-kyorugui-medal-table.module.ts
import { Module } from '@nestjs/common';
import { TaekwondoKyoruguiMedalTableService }    from './taekwondo-kyorugui-medal-table.service';
import { TaekwondoKyoruguiMedalTableController } from './taekwondo-kyorugui-medal-table.controller';

@Module({
  controllers: [TaekwondoKyoruguiMedalTableController],
  providers:   [TaekwondoKyoruguiMedalTableService],
  exports:     [TaekwondoKyoruguiMedalTableService],
})
export class TaekwondoKyoruguiMedalTableModule {}