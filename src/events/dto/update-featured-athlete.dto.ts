import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFeaturedAthleteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
