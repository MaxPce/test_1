import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne, // ← cambiar de ManyToOne a OneToOne
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Participation } from './participation.entity';

@Entity('climbing_scores')
@Index(['participationId'])
export class ClimbingScore {
  @PrimaryGeneratedColumn({ name: 'score_id' })
  scoreId: number;

  @Column({ name: 'participation_id', unique: true })
  participationId: number;

  @Column({
    name: 'result',
    type: 'decimal',
    precision: 8,
    scale: 3,
    nullable: true,
  })
  result: number | null;

  @Column({ name: 'rank', type: 'int', nullable: true })
  rank: number | null;

  @Column({ name: 'points', type: 'int', nullable: true })
  points: number | null;

  @Column({ name: 'notes', type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @JoinColumn({ name: 'participation_id' })
  participation: Participation;
}
