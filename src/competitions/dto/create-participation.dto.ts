import { IsNumber, IsEnum, IsOptional } from 'class-validator';
import { Corner } from '../../common/enums';

export class CreateParticipationDto {
  @IsNumber()
  matchId: number;

  @IsNumber()
  registrationId: number;

  @IsOptional()
  @IsEnum(Corner)
  corner?: Corner;
}
