import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormatsController } from './formats.controller';
import { FormatsService } from './formats.service';
import { Format } from '../entities/format.entity';
import { FormatField } from '../entities/format-field.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Format, FormatField])],
  controllers: [FormatsController],
  providers: [FormatsService],
})
export class FormatsModule {}
