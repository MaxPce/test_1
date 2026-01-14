import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class CreateResultDto {
  @IsNumber()
  participationId: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  scoreValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rankPosition?: number;

  @IsOptional()
  @IsBoolean()
  isWinner?: boolean;

  @IsOptional()
  @IsString()
  timeValue?: string; // Formato: "HH:MM:SS"

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
