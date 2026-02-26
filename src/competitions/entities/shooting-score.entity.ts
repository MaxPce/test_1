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

@Entity('shooting_scores')
@Index(['participationId'], { unique: true })
export class ShootingScore {
  @PrimaryGeneratedColumn({ name: 'shooting_score_id' })
  shootingScoreId: number;

  @Column({ name: 'participation_id' })
  participationId: number;

  @Column({
    name: 'series',
    type: 'json',
    nullable: true,
    comment: 'Array de puntajes por serie, ej: [85.2, 92.1, 89.0, 93.5, 90.3, 91.0]',
  })
  series: number[];

  @Column({
    name: 'total',
    type: 'decimal',
    precision: 6,
    scale: 1,
    nullable: true,
    comment: 'Suma total de todas las series',
  })
  total: number | null;

  @Column({
    name: 'rank',
    nullable: true,
    comment: 'Posición en la fase',
  })
  rank: number;

  @Column({
    name: 'dns',
    type: 'boolean',
    default: false,
    comment: 'Did Not Shoot - no se presentó',
  })
  dns: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Participation)
  @JoinColumn({ name: 'participation_id' })
  participation: Participation;
}
