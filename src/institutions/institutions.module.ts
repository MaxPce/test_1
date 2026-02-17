import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionsService } from './institutions.service';
import { InstitutionsController } from './institutions.controller';
import { Institution, Athlete, Team, TeamMember } from './entities';
import { UploadService } from '../common/services/upload.service';
import { SismasterModule } from '../sismaster/sismaster.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, Athlete, Team, TeamMember]),
    SismasterModule,  
  ],
  controllers: [InstitutionsController],
  providers: [InstitutionsService, UploadService],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}

