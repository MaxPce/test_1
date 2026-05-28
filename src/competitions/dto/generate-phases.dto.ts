import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
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

  /**
   * Si true → genera fases Y crea los matches del bracket automáticamente.
   * Si false (default) → solo crea fases con atletas asignados, sin matches.
   */
  @IsOptional()
  @IsBoolean()
  generateMatches?: boolean;
}