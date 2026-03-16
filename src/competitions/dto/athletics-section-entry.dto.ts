import {
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpsertSectionEntryDto {
  @IsInt()
  athleticsSectionId: number;

  @IsInt()
  phaseRegistrationId: number;

  @ValidateIf((o) => o.lane !== undefined && o.lane !== null)
  @Transform(({ value }) => (value != null ? Number(value) : null))
  @IsInt()
  lane?: number | null;

  @ValidateIf((o) => o.time !== undefined && o.time !== null)
  @IsString()
  time?: string | null;

  @ValidateIf((o) => o.wind !== undefined && o.wind !== null)
  @Transform(({ value }) => (value != null ? Number(value) : null))
  @IsNumber()
  wind?: number | null;

  @ValidateIf((o) => o.notes !== undefined && o.notes !== null)
  @IsString()
  notes?: string | null;
}

export class AssignSectionEntriesDto {
  @IsInt()
  athleticsSectionId: number;

  @IsInt({ each: true })
  toAdd: number[];

  @IsInt({ each: true })
  toRemove: number[];
}
