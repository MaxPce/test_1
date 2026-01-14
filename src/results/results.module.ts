import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { Result, Attempt } from './entities';
import { Match, Participation, Standing } from '../competitions/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Result, Attempt, Match, Participation, Standing]),
  ],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
