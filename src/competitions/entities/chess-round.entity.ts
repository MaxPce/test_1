import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Phase } from './phase.entity';
import { ChessMatch } from './chess-match.entity';

@Entity('chess_round')
export class ChessRound {
  @PrimaryGeneratedColumn({ name: 'chess_round_id' })
  chessRoundId: number;

  @Column({ name: 'phase_id' })
  phaseId: number;

  @ManyToOne(() => Phase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string; // "Rd.1", "Rd.2", etc.

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ChessMatch, (m) => m.chessRound)
  matches: ChessMatch[];
}
