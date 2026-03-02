import { IsOptional, IsNumber } from 'class-validator';

export class UpdateClimbingScoreDto {
  @IsOptional()
  @IsNumber()
  total?: number | null;

  @IsOptional()
  @IsNumber()
  rank?: number | null;
}
