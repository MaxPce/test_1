import {
  IsArray,
  IsEnum,
  IsNumber,
} from 'class-validator';

export enum TennisGenerationMode {
  WITH_MATCHES = 'with_matches',
  PHASES_ONLY  = 'phases_only',
}

export class GenerateTennisPhasesDto {
  @IsNumber()
  eventCategoryId: number;

  @IsEnum(TennisGenerationMode)
  mode: TennisGenerationMode;

  @IsArray()
  @IsNumber({}, { each: true })
  registrationIds: number[];
}