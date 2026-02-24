import { IsNumber, Min, Max } from 'class-validator';

export class UpdateTaoluScoreDto {
  @IsNumber()
  @Min(0)
  accuracy: number;

  @IsNumber()
  @Min(0)
  presentation: number;
}
