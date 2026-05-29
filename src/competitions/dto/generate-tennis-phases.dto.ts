// generate-tennis-phases.dto.ts
import { IsArray, IsEnum, IsString, IsInt, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum TennisPhaseFormat {
  SINGLE_ELIMINATION = 'single_elimination',
  ROUND_ROBIN = 'round_robin',
  BEST_OF_3 = 'best_of_3',
}

class TennisPhaseGroupDto {
  @IsString()
  name: string;

  @IsEnum(TennisPhaseFormat)
  format: TennisPhaseFormat;

  @IsArray()
  @IsInt({ each: true })
  registrationIds: number[];
}

export class GenerateTennisPhasesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TennisPhaseGroupDto)
  groups: TennisPhaseGroupDto[];
}