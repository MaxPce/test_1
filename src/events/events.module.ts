import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event, EventCategory, Registration } from './entities';
import { UploadService } from '../common/services/upload.service'; 

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventCategory, Registration])],
  controllers: [EventsController],
  providers: [EventsService, UploadService],
  exports: [EventsService],
})
export class EventsModule {}
