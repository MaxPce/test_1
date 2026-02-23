import { IsNumber, IsOptional } from 'class-validator';

export class UpdateKarateScoreDto {
  @IsNumber()
  participant1Score: number;

  @IsNumber()
  participant2Score: number;

  @IsOptional()
  @IsNumber()
  winnerRegistrationId?: number;
}
