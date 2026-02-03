import {
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para un round individual de Kyorugui
 */
export class KyoruguiRoundDto {
  @IsNumber()
  @Min(1)
  @Max(3)
  roundNumber: number; // 1, 2 o 3

  @IsNumber()
  @Min(0)
  participant1Points: number; // Puntos del participante 1 en este round

  @IsNumber()
  @Min(0)
  participant2Points: number; // Puntos del participante 2 en este round

  @IsOptional()
  @IsNumber()
  winnerId?: number; // ID del ganador del round (se puede calcular automáticamente)
}

/**
 * DTO para actualizar todos los rounds de un match de Kyorugui
 */
export class UpdateKyoruguiRoundsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KyoruguiRoundDto)
  rounds: KyoruguiRoundDto[]; // Array de rounds (máximo 3)

  @IsOptional()
  @IsNumber()
  winnerRegistrationId?: number; // Ganador del match completo (se calcula automáticamente)
}

/**
 * DTO para actualizar un solo round
 */
export class UpdateSingleRoundDto {
  @IsNumber()
  @Min(1)
  @Max(3)
  roundNumber: number;

  @IsNumber()
  @Min(0)
  participant1Points: number;

  @IsNumber()
  @Min(0)
  participant2Points: number;
}
