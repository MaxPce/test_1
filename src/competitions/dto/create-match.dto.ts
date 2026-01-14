import {
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { MatchStatus } from '../../common/enums';

export class CreateMatchDto {
  @IsNumber()
  phaseId: number;

  @IsOptional()
  @IsNumber()
  matchNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  round?: string;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @IsOptional()
  @IsDateString()
  scheduledTime?: string;

  @IsOptional()
  @IsNumber()
  platformNumber?: number;
}
