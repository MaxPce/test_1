import { PartialType } from '@nestjs/mapped-types';
import { CreateMatchDto } from './create-match.dto';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateMatchDto extends PartialType(CreateMatchDto) {
  @IsOptional()
  @IsNumber()
  winnerRegistrationId?: number;
}
