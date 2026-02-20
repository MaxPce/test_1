import { PartialType } from '@nestjs/mapped-types';
import { CreateMatchDto } from './create-match.dto';
import { IsNumber, IsOptional, IsBoolean, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMatchDto extends PartialType(CreateMatchDto) {

  // ── Ganador / estado ──────────────────────────────────────────
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  winnerRegistrationId?: number;

  // ── Puntajes generales (kyorugi, tenis de mesa, etc.) ─────────
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  participant1Score?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  participant2Score?: number;

  // ── Poomsae: Accuracy ─────────────────────────────────────────
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  participant1Accuracy?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  participant2Accuracy?: number;

  // ── Poomsae: Presentation ─────────────────────────────────────
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  participant1Presentation?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  participant2Presentation?: number;

  // ── Walkover ──────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  isWalkover?: boolean;

  @IsOptional()
  @IsString()
  walkoverReason?: string;
}
