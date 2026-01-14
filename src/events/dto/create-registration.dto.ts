import { IsNumber, IsOptional, ValidateIf } from 'class-validator';

export class CreateRegistrationDto {
  @IsNumber()
  eventCategoryId: number;

  @ValidateIf((o) => !o.teamId)
  @IsNumber()
  athleteId?: number;

  @ValidateIf((o) => !o.athleteId)
  @IsNumber()
  teamId?: number;

  @IsOptional()
  @IsNumber()
  seedNumber?: number;
}
