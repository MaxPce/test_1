import { IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { GameStatus } from '../entities/match-game.entity';

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
