import { IsNumber, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class GenerateBracketDto {
  @IsNumber()
  phaseId: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  registrationIds?: number[];

  @IsOptional()
  @IsBoolean()
  includeThirdPlace?: boolean;

  @IsOptional()
  @IsNumber()
  bracketSize?: number;
}
