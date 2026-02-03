import {
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  IsArray,
  ValidateNested,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GameStatus } from '../entities/match-game.entity';

export class GameSetDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  setNumber: number;

  @IsNumber()
  @Min(0)
  player1Score: number;

  @IsNumber()
  @Min(0)
  player2Score: number;

  @IsOptional()
  @IsNumber()
  winnerId?: number | null;
}

export class CreateMatchGameDto {
  @IsNumber()
  matchId: number;

  @IsNumber()
  @Min(1)
  gameNumber: number;

  @IsNumber()
  player1Id: number;

  @IsNumber()
  player2Id: number;
}

export class UpdateMatchGameDto {
  // ✅ AGREGAR: Campo opcional para sets (solo tenis de mesa)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GameSetDto)
  sets?: GameSetDto[];

  // Mantener campos existentes para compatibilidad con otros deportes
  @IsOptional()
  @IsNumber()
  @Min(0)
  score1?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score2?: number;

  @IsOptional()
  @IsNumber()
  winnerId?: number;

  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;
}

export class GenerateGamesDto {
  @IsNumber()
  matchId: number;
}
