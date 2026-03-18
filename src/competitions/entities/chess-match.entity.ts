import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChessRound } from './chess-round.entity';
import { PhaseRegistration } from './phase-registration.entity';

export type ChessMatchResult = '1-0' | '0-1' | '½-½' | null;

@Entity('chess_match')
export class ChessMatch {
  @PrimaryGeneratedColumn({ name: 'chess_match_id' })
  chessMatchId: number;

  @Column({ name: 'chess_round_id' })
  chessRoundId: number;

  @ManyToOne(() => ChessRound, (r) => r.matches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chess_round_id' })
  chessRound: ChessRound;

  // Jugador con piezas blancas
  @Column({ name: 'white_phase_registration_id' })
  whitePhaseRegistrationId: number;

  @ManyToOne(() => PhaseRegistration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'white_phase_registration_id' })
  whitePhaseRegistration: PhaseRegistration;

  // Jugador con piezas negras
  @Column({ name: 'black_phase_registration_id' })
  blackPhaseRegistrationId: number;

  @ManyToOne(() => PhaseRegistration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'black_phase_registration_id' })
  blackPhaseRegistration: PhaseRegistration;

  // "1-0" | "0-1" | "½-½" | null (pendiente)
  @Column({
    name: 'result',
    type: 'varchar',
    length: 10,
    nullable: true,
    default: null,
  })
  result: ChessMatchResult;

  @Column({ name: 'board_number', type: 'int', nullable: true, default: null })
  boardNumber: number | null;

  @Column({ name: 'notes', type: 'text', nullable: true, default: null })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
