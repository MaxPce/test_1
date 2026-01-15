import { IsNumber, IsString, IsOptional, Matches } from 'class-validator';

export class CreateTimeResultDto {
  @IsNumber()
  registrationId: number;

  @IsString()
  @Matches(/^(x)?(\d{1,2}:)?\d{1,2}:\d{2}\.\d{2}$/, {
    message:
      'El formato del tiempo debe ser MM:SS.MS o HH:MM:SS.MS (ej: 1:15.60 o x1:24.80)',
  })
  timeValue: string;

  @IsNumber()
  @IsOptional()
  rankPosition?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
