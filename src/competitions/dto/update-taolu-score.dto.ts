import { IsNumber, Min } from 'class-validator';

export class UpdateTaoluScoreDto {
  @IsNumber()
  @Min(0)
  total: number;
}