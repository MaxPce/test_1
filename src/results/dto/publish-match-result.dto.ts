import {
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MatchStatus } from '../../common/enums';

class ParticipationResultDto {
  @IsNumber()
  participationId: number;

  @IsOptional()
  @IsNumber()
  scoreValue?: number;

  @IsOptional()
  @IsString()
  timeValue?: string;

  @IsOptional()
  @IsBoolean()
  isWinner?: boolean;

  @IsOptional()
  @IsNumber()
  rankPosition?: number;
}

export class PublishMatchResultDto {
  @IsNumber()
  matchId: number;

  @IsEnum(MatchStatus)
  status: MatchStatus;

  @IsOptional()
  @IsNumber()
  winnerRegistrationId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipationResultDto)
  participations: ParticipationResultDto[];
}
