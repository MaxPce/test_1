import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateSportTypeDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
