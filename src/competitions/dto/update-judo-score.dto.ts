import { IsNumber, Min, IsOptional } from 'class-validator';

export class UpdateJudoScoreDto {
  @IsNumber()
  @Min(0)
  participant1Score: number;

  @IsNumber()
  @Min(0)
  participant2Score: number;

  @IsOptional()
  @IsNumber()
  winnerRegistrationId?: number;
}
