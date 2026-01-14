import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateFormatFieldDto } from './create-format-field.dto';

export class CreateFormatDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormatFieldDto)
  fields?: CreateFormatFieldDto[];
}
