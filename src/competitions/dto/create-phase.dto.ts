import {
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { PhaseType } from '../../common/enums';

export class CreatePhaseDto {
  @IsNumber()
  eventCategoryId: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(PhaseType)
  type: PhaseType;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}
