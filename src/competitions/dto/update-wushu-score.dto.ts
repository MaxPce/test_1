import { IsNumber, IsOptional } from 'class-validator';

export class UpdateWushuScoreDto {
  @IsNumber()
  participant1Score: number;

  @IsNumber()
  participant2Score: number;

  @IsOptional()
  @IsNumber()
  winnerRegistrationId?: number;
}
