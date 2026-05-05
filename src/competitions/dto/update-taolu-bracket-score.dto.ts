import { IsNumber, Min, Max } from 'class-validator';

export class UpdateTaoluBracketScoreDto {
  @IsNumber()
  @Min(0)
  @Max(10)
  accuracy: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  presentation: number;
}