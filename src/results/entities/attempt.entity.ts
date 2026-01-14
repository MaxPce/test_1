import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { Participation } from '../../competitions/entities/participation.entity';

@Entity('attempts')
@Index(['participationId'])
@Unique('unique_participation_attempt', ['participationId', 'attemptNumber'])
export class Attempt {
  @PrimaryGeneratedColumn({ name: 'attempt_id' })
  attemptId: number;

  @Column({ name: 'participation_id' })
  participationId: number;

  @Column({
    name: 'attempt_number',
    nullable: true,
    comment: 'Número de intento 1,2,3...',
  })
  attemptNumber: number;

  @Column({
    name: 'attempt_type',
    length: 50,
    nullable: true,
    comment: 'arranque, envion, salto, lanzamiento',
  })
  attemptType: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  value: number;

  @Column({ name: 'is_valid', type: 'boolean', default: true, nullable: true })
  isValid: boolean;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @ManyToOne(() => Participation)
  @JoinColumn({ name: 'participation_id' })
  participation: Participation;
}
