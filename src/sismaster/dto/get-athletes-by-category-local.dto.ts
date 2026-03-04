// src/sismaster/dto/get-athletes-by-category-local.dto.ts
import { IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAthletesByCategoryLocalDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sismasterEventId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  localSportId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  idparam: number;
}
