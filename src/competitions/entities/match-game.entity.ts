import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Match } from './match.entity';
import { Athlete } from '../../institutions/entities/athlete.entity';

export enum GameStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export interface GameSet {
  setNumber: number;
  player1Score: number;
  player2Score: number;
  winnerId?: number | null;
}

@Entity('match_games')
@Index(['matchId'])
@Index(['player1Id'])
@Index(['player2Id'])
export class MatchGame {
  @PrimaryGeneratedColumn({ name: 'game_id' })
  gameId: number;

  @Column({ name: 'match_id' })
  matchId: number;

  @Column({
    name: 'game_number',
    type: 'tinyint',
    comment: 'Número del juego (1, 2, 3, 4, 5)',
  })
  gameNumber: number;

  @Column({ name: 'player1_id', comment: 'Atleta del equipo 1' })
  player1Id: number;

  @Column({ name: 'player2_id', comment: 'Atleta del equipo 2' })
  player2Id: number;

  @Column({
    name: 'sets',
    type: 'json',
    nullable: true,
    comment: 'Detalle de sets jugados (hasta 5)',
  })
  sets: GameSet[] | null;

  @Column({
    name: 'score1',
    type: 'tinyint',
    nullable: true,
    comment: 'Sets ganados por jugador 1',
  })
  score1: number | null;

  @Column({
    name: 'score2',
    type: 'tinyint',
    nullable: true,
    comment: 'Sets ganados por jugador 2',
  })
  score2: number | null;

  @Column({ name: 'winner_id', nullable: true })
  winnerId: number | null;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.PENDING,
  })
  status: GameStatus;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  // Relaciones
  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player1_id' })
  player1: Athlete;

  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player2_id' })
  player2: Athlete;

  @ManyToOne(() => Athlete, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'winner_id' })
  winner: Athlete;
}
