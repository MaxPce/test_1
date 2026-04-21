// src/competitions/dto/update-phase-settings.dto.ts

import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { PhaseGender, PhaseLevel } from '../../common/enums';

export class UpdatePhaseSettingsDto {
  @IsOptional()
  @IsEnum(PhaseGender, {
    message: `gender debe ser: ${Object.values(PhaseGender).join(' | ')}`,
  })
  gender?: PhaseGender;

  @IsOptional()
  @IsEnum(PhaseLevel, {
    message: `level debe ser: ${Object.values(PhaseLevel).join(' | ')}`,
  })
  level?: PhaseLevel;

  @IsOptional()
  @IsBoolean()
  isRelay?: boolean;
}