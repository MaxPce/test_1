import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionsService } from './institutions.service';
import { InstitutionsController } from './institutions.controller';
import { Institution, Athlete, Team, TeamMember } from './entities';

@Module({
  imports: [TypeOrmModule.forFeature([Institution, Athlete, Team, TeamMember])],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
