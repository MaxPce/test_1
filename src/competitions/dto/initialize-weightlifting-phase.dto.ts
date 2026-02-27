import { IsArray, ValidateNested, IsInt, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class WeightliftingEntryDto {
  @IsInt()
  registrationId: number;

  @IsString()
  @IsOptional()
  weightClass?: string | null;
}

export class InitializeWeightliftingPhaseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeightliftingEntryDto)
  entries: WeightliftingEntryDto[];
}
