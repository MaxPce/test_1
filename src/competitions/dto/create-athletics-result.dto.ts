import {
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HeightResult } from '../entities/athletics-result.entity';

export class CreateAthleticsResultDto {
  @IsInt()
  phaseRegistrationId: number;

  // ── Carreras ──────────────────────────────────────
  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  lane?: number;

  @IsOptional()
  @IsInt()
  athleticsSectionId?: number | null;

  // ── Saltos / lanzamientos ─────────────────────────
  @IsOptional()
  @IsInt()
  @Min(1)
  attemptNumber?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  distanceValue?: number;

  @IsOptional()
  @IsBoolean()
  isValid?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  wind?: number;

  // ── Salto alto / garrocha ─────────────────────────
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  height?: number;

  @IsOptional()
  @IsEnum(HeightResult)
  heightResult?: HeightResult;

  // ── Combinado ─────────────────────────────────────
  @IsOptional()
  @IsString()
  combinedEvent?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rawValue?: number;

  @IsOptional()
  @IsInt()
  iaafPoints?: number;

  // ── Metadata ──────────────────────────────────────
  @IsOptional()
  @IsString()
  notes?: string;
}
