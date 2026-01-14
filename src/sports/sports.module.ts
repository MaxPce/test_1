import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SportsService } from './sports.service';
import { SportsController } from './sports.controller';
import { SportType, Sport, Category } from './entities';

@Module({
  imports: [TypeOrmModule.forFeature([SportType, Sport, Category])],
  controllers: [SportsController],
  providers: [SportsService],
  exports: [SportsService],
})
export class SportsModule {}
