// src/competitions/dto/generate-kumite-phases.dto.ts
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type KumitePhaseFormat =
  | 'single_elimination'
  | 'round_robin'
  | 'best_of_3';

export class KumiteGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['single_elimination', 'round_robin', 'best_of_3'])
  format: KumitePhaseFormat;

  @IsArray()
  @IsNumber({}, { each: true })
  registrationIds: number[];
}

export class GenerateKumitePhasesDto {
  @IsNumber()
  eventCategoryId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KumiteGroupDto)
  groups: KumiteGroupDto[];
}