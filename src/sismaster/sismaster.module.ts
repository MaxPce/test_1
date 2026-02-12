// src/sismaster/sismaster.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SismasterService } from './sismaster.service';
import { SismasterController } from './sismaster.controller';
import {
  SismasterEvent,
  SismasterPerson,
  SismasterInstitution,
  SismasterSport,
  SismasterAccreditation,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        SismasterEvent,
        SismasterPerson,
        SismasterInstitution,
        SismasterSport,
        SismasterAccreditation,
      ],
      'sismaster',
    ),
  ],
  controllers: [SismasterController],
  providers: [SismasterService],
  exports: [SismasterService],
})
export class SismasterModule {}
