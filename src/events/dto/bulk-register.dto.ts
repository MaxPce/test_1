import { IsNumber, IsArray, IsOptional } from 'class-validator';

export class BulkRegisterDto {
  @IsNumber()
  eventCategoryId: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  athleteIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  teamIds?: number[];
}
