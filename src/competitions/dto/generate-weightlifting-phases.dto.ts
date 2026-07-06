// src/competitions/dto/generate-weightlifting-phases.dto.ts
import { IsArray, IsNumber, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WeightliftingEntryDto } from './initialize-weightlifting-phase.dto';

export class WeightliftingGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsNumber({}, { each: true })
  registrationIds: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeightliftingEntryDto)
  entries: WeightliftingEntryDto[];
}

export class GenerateWeightliftingPhasesDto {
  @IsNumber()
  eventCategoryId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeightliftingGroupDto)
  groups: WeightliftingGroupDto[];
}