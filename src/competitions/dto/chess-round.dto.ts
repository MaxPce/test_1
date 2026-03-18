import { IsInt, IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateChessRoundDto {
  @IsInt()
  phaseId: number;

  @IsString()
  name: string; // "Rd.1", "Rd.2" …

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateChessRoundDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
