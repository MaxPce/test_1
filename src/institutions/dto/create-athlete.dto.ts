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

export class CreateAthleteDto {
  @IsOptional()
  @IsNumber()
  institutionId?: number;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsDateString()
  dateBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  docNumber?: string;
}
