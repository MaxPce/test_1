import { IsArray, IsEnum, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export type PhaseFormat = 'single_elimination' | 'round_robin' | 'best_of_3';

export class PhaseGroupDto {
  @IsString()
  name: string;

  @IsEnum(['single_elimination', 'round_robin', 'best_of_3'])
  format: PhaseFormat;

  @IsArray()
  @IsNumber({}, { each: true })
  registrationIds: number[];
}

export class GeneratePhasesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhaseGroupDto)
  groups: PhaseGroupDto[];
}