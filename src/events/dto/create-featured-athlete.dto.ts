import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFeaturedAthleteDto {
  @IsInt()
  eventCategoryId: number;

  @IsInt()
  registrationId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
