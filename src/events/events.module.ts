import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event, EventCategory, Registration } from './entities';
import { UploadService } from '../common/services/upload.service'; 
import { Athlete } from '../institutions/entities/athlete.entity';
import { Institution } from '../institutions/entities/institution.entity'; 
import { SismasterModule } from '../sismaster/sismaster.module'; 

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventCategory, Registration, Athlete, Institution]), SismasterModule],
  controllers: [EventsController],
  providers: [EventsService, UploadService],
  exports: [EventsService],
})
export class EventsModule {}
