import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateTaoluScoreDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  b1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  b2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  b3?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  a1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  a2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  juezPrincipalMinus?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  juezPrincipalPlus?: number | null;
}