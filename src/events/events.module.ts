import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event, EventCategory, Registration } from './entities';
import { UploadService } from '../common/services/upload.service';
import { Athlete } from '../institutions/entities/athlete.entity';
import { Institution } from '../institutions/entities/institution.entity';
import { SismasterModule } from '../sismaster/sismaster.module';
import { RegistrationEnrichmentService } from './services/registration-enrichment.service';
import { Company } from '../companies/entities/company.entity';
import { FeaturedAthlete } from './entities/featured-athlete.entity';
import { Sport } from '../sports/entities/sport.entity';
import { Category } from '../sports/entities/category.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      EventCategory,
      Registration,
      Athlete,
      Institution,
      Company,
      FeaturedAthlete,
      Category,  
      Sport,
    ]),
    SismasterModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, UploadService, RegistrationEnrichmentService],
  exports: [EventsService, RegistrationEnrichmentService],
})
export class EventsModule {}
