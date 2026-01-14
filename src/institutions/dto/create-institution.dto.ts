import { IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateInstitutionDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  abrev?: string;
}
