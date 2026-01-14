import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Participation } from '../../competitions/entities/participation.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('results')
@Index(['participationId'])
export class Result {
  @PrimaryGeneratedColumn({ name: 'result_id' })
  resultId: number;

  @Column({ name: 'participation_id', nullable: true })
  participationId: number;

  @Column({
    name: 'score_value',
    nullable: true,
    comment: 'Puntos en combate o general',
  })
  scoreValue?: number; // ✅ Usar ? en lugar de | null

  @Column({
    name: 'rank_position',
    nullable: true,
    comment: 'Posición final: 1,2,3',
  })
  rankPosition?: number; // ✅ Usar ?

  @Column({
    name: 'is_winner',
    type: 'boolean',
    default: false,
    nullable: true,
  })
  isWinner?: boolean; // ✅ Usar ?

  @Column({
    name: 'time_value',
    type: 'time',
    nullable: true,
    comment: 'Para deportes cronometrados',
  })
  timeValue?: string; // ✅ Usar ?

  @Column({
    name: 'total_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Total general (ej: arranque+envión)',
  })
  totalValue?: number; // ✅ Usar ?

  @Column({ type: 'text', nullable: true })
  notes?: string; // ✅ Usar ?

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;

  @Column({ name: 'recorded_by', nullable: true })
  recordedBy: number;

  @ManyToOne(() => Participation)
  @JoinColumn({ name: 'participation_id' })
  participation: Participation;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recorded_by' })
  recordedByUser: User;
}
