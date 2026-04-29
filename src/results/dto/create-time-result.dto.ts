// src/results/dto/create-time-result.dto.ts
import { IsNumber, IsString, IsOptional, Matches } from 'class-validator';

export class CreateTimeResultDto {
  @IsNumber()
  registrationId: number;

  @IsString()
  @Matches(/^(DNS|DNF|DQ|(x)?(\d{1,2}:)?\d{1,2}:\d{2}\.\d{2})$/, {  
    message:
      'El formato del tiempo debe ser MM:SS.MS, HH:MM:SS.MS, o un estado especial (DNS, DNF, DQ)',
  })
  timeValue: string;

  @IsNumber()
  @IsOptional()
  rankPosition?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  phaseId?: number;
}