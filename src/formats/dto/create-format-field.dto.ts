import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { FieldType } from '../../entities/format-field.entity';

export class CreateFormatFieldDto {
  @IsString()
  @MaxLength(120)
  label: string;

  @IsOptional()
  @IsIn(['text', 'number', 'date', 'select'])
  type?: FieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
