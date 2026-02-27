import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Participation } from './participation.entity';

export type AttemptResult = 'valid' | 'invalid' | 'not_attempted';
export type LiftType = 'snatch' | 'clean_and_jerk';

@Entity('weightlifting_attempts')
@Index(['participationId', 'liftType', 'attemptNumber'], { unique: true })
export class WeightliftingAttempt {
  @PrimaryGeneratedColumn({ name: 'attempt_id' })
  attemptId: number;

  @Column({ name: 'participation_id' })
  participationId: number;

  @Column({
    name: 'lift_type',
    type: 'enum',
    enum: ['snatch', 'clean_and_jerk'],
    comment: 'Tipo de movimiento: Arranque o Envión',
  })
  liftType: LiftType;

  @Column({
    name: 'attempt_number',
    type: 'tinyint',
    comment: 'Número de intento: 1, 2 o 3',
  })
  attemptNumber: 1 | 2 | 3;

  @Column({
    name: 'weight_kg',
    type: 'decimal',
    precision: 5,
    scale: 1,
    nullable: true,
    comment: 'Peso declarado en kilogramos',
  })
  weightKg: number | null;

  @Column({
    name: 'result',
    type: 'enum',
    enum: ['valid', 'invalid', 'not_attempted'],
    default: 'not_attempted',
    comment: 'Resultado del intento',
  })
  result: AttemptResult;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Participation)
  @JoinColumn({ name: 'participation_id' })
  participation: Participation;
}
