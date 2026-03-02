// featured-athletes/dto/upsert-featured-athlete-by-phase.dto.ts
import { IsInt, IsPositive, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertFeaturedAthleteByPhaseDto {
  @IsInt()
  @IsPositive()
  phaseId: number;

  @IsInt()
  @IsPositive()
  eventCategoryId: number;

  @IsInt()
  @IsPositive()
  registrationId: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
