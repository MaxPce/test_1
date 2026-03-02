import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  MaxLength,
  IsNumber,
} from 'class-validator';
import { EventStatus } from '../../common/enums';

export class CreateEventDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsNumber()
  companyId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logoUrl?: string;
}
