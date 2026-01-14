import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateLiveScoreDto {
  @IsNumber()
  matchId: number;

  @IsNumber()
  participationId: number;

  @IsOptional()
  @IsNumber()
  scoreValue?: number;

  @IsOptional()
  @IsString()
  timeValue?: string;
}
