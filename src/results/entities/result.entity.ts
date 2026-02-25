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
import { Phase } from '../../competitions/entities/phase.entity'; 

@Entity('results')
@Index(['participationId'])
@Index(['phaseId']) 
export class Result {
  @PrimaryGeneratedColumn({ name: 'result_id' })
  resultId: number;

  @Column({ name: 'participation_id', nullable: true })
  participationId: number;

  @Column({ name: 'phase_id', nullable: true })
  phaseId: number | null;

  @Column({
    type: 'int',
    name: 'score_value',
    nullable: true,
    comment: 'Puntos en combate o general',
  })
  scoreValue: number | null;

  @Column({
    type: 'int',
    name: 'rank_position',
    nullable: true,
    comment: 'Posición final: 1,2,3',
  })
  rankPosition: number | null;

  @Column({
    name: 'is_winner',
    type: 'boolean',
    default: false,
    nullable: true,
  })
  isWinner: boolean | null;

  @Column({
    type: 'time',
    name: 'time_value',
    nullable: true,
    comment: 'Para deportes cronometrados',
  })
  timeValue: string | null;

  @Column({
    name: 'total_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Total general (ej: arranque+envión)',
  })
  totalValue: number | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes: string | null;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;

  @Column({ name: 'recorded_by', nullable: true })
  recordedBy: number;

  @ManyToOne(() => Participation)
  @JoinColumn({ name: 'participation_id' })
  participation: Participation;

  @ManyToOne(() => Phase, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recorded_by' })
  recordedByUser: User;
}
