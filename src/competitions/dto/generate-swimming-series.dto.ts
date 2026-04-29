// src/competitions/dto/generate-swimming-series.dto.ts
import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateSwimmingSeriesGroupDto {
  @IsString()
  name: string;

  @IsArray()
  @IsInt({ each: true })
  registrationIds: number[];
}

export class GenerateSwimmingSeriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerateSwimmingSeriesGroupDto)
  groups: GenerateSwimmingSeriesGroupDto[];
}