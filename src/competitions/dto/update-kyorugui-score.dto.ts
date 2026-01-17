import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateKyoruguiScoreDto {
  @IsNumber()
  @Min(0)
  participant1Score: number;

  @IsNumber()
  @Min(0)
  participant2Score: number;

  @IsNumber()
  @IsOptional()
  winnerRegistrationId?: number;
}
