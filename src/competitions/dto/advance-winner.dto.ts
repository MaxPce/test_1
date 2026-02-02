import { IsNumber, IsOptional } from 'class-validator';

export class AdvanceWinnerDto {
  @IsNumber()
  matchId: number;

  @IsNumber()
  winnerRegistrationId: number;

  @IsOptional()
  @IsNumber()
  participant1Score?: number;

  @IsOptional()
  @IsNumber()
  participant2Score?: number;
}
