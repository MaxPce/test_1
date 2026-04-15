import {
  IsArray,
  IsNumber,
  IsString,
  ValidateNested,
  ArrayMinSize,
  IsNotEmpty,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PhaseType } from 'src/common/enums';

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

  @IsOptional()
  @IsEnum(PhaseType)
  phaseType?: PhaseType;
}
