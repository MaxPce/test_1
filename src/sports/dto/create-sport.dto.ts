import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  IsUrl,
} from 'class-validator';

export class CreateSportDto {
  @IsNumber()
  sportTypeId: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  iconUrl?: string;
}
