import { IsNumber, IsArray, IsOptional, IsEnum } from 'class-validator';

export class GenerateBracketDto {
  @IsNumber()
  phaseId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  registrationIds: number[];

  @IsOptional()
  @IsEnum(['single_elimination', 'double_elimination'])
  bracketType?: string;
}
