import { IsNumber, IsArray, ArrayMinSize, ArrayMaxSize, Min, Max } from 'class-validator';

export class UpdateShootingScoreDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  
  series: number[];
}
