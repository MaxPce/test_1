import { IsInt, IsPositive, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFormatFromSismasterDto {
  @Type(() => Number)
  @IsInt() @IsPositive()
  eventCategoryId: number;     

  @Type(() => Number)
  @IsInt() @IsPositive()
  sportParamId: number;        

  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(2)
  groupCount?: number;         
}
