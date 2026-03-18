import {
  IsInt,
  IsOptional,
  IsIn,
  IsString,
} from 'class-validator';

export class CreateChessMatchDto {
  @IsInt()
  chessRoundId: number;

  @IsInt()
  whitePhaseRegistrationId: number;

  @IsInt()
  blackPhaseRegistrationId: number;

  @IsOptional()
  @IsInt()
  boardNumber?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateChessMatchDto {
  @IsOptional()
  @IsIn(['1-0', '0-1', '½-½', null])
  result?: '1-0' | '0-1' | '½-½' | null;

  @IsOptional()
  @IsInt()
  boardNumber?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
