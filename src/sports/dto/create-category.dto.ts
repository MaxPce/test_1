import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  FormatType,
  ResultType,
  Gender,
  CategoryType,
} from '../../common/enums';

export class CreateCategoryDto {
  @IsOptional()
  @IsNumber()
  sportId?: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(FormatType)
  formatType: FormatType;

  @IsEnum(ResultType)
  resultType: ResultType;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  weightMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999.99)
  weightMax?: number;

  @IsEnum(CategoryType)
  type: CategoryType;
}
