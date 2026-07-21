// src/events/dto/create-local-athlete-registration.dto.ts
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  Length,
} from 'class-validator';
import { Gender } from '../../common/enums';

export class CreateLocalAthleteRegistrationDto {
  @IsNumber()
  eventCategoryId: number;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  docNumber?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateBirth?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoUrl?: string;

  @IsOptional()
  @IsNumber()
  institutionId?: number;

  @IsOptional()
  @IsNumber()
  seedNumber?: number;
}