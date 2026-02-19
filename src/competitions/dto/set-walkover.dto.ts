import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SetWalkoverDto {
  @IsNumber()
  winnerRegistrationId: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
