import {
  IsArray,
  IsNumber,
  IsString,
  ValidateNested,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SeriesGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  registrationIds: number[];
}

export class GenerateAthleticsSeriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SeriesGroupDto)
  groups: SeriesGroupDto[];
}