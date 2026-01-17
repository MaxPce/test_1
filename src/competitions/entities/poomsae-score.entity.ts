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

@Entity('poomsae_scores')
@Index(['participationId'])
export class PoomsaeScore {
  @PrimaryGeneratedColumn({ name: 'score_id' })
  scoreId: number;

  @Column({ name: 'participation_id' })
  participationId: number;

  @Column({
    name: 'accuracy',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Puntuación de precisión técnica (ACC)',
  })
  accuracy: number;

  @Column({
    name: 'presentation',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Puntuación de presentación (PRE)',
  })
  presentation: number;

  @Column({
    name: 'total',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Suma total (ACC + PRE)',
  })
  total: number;

  @Column({
    name: 'rank',
    nullable: true,
    comment: 'Posición/Puesto en la categoría',
  })
  rank: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Participation)
  @JoinColumn({ name: 'participation_id' })
  participation: Participation;
}
