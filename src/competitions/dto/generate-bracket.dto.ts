import { IsNumber, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class GenerateBracketDto {
  @IsNumber()
  phaseId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  registrationIds: number[];

  @IsOptional()
  @IsBoolean()
  includeThirdPlace?: boolean;
}
