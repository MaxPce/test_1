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

@Entity('individual_scores')
@Index(['participationId'])
export class IndividualScore {
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

  // ──────────────── CAMPOS TAOLU WUSHU ────────────────

  @Column({
    name: 'b1',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
    comment: 'Juez B1 - Puntuación técnica',
  })
  b1: number | null;

  @Column({
    name: 'b2',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
    comment: 'Juez B2 - Puntuación técnica',
  })
  b2: number | null;

  @Column({
    name: 'b3',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
    comment: 'Juez B3 - Puntuación técnica',
  })
  b3: number | null;

  @Column({
    name: 'a1',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
    comment: 'Juez A1 - Puntuación artística',
  })
  a1: number | null;

  @Column({
    name: 'a2',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
    comment: 'Juez A2 - Puntuación artística',
  })
  a2: number | null;

  @Column({
    name: 'juez_principal_minus',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
    default: 0,
    comment: 'Deducción del Juez Principal (-)',
  })
  juezPrincipalMinus: number | null;

  @Column({
    name: 'juez_principal_plus',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
    default: 0,
    comment: 'Bonificación del Juez Principal (+)',
  })
  juezPrincipalPlus: number | null;

  // ─────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Participation)
  @JoinColumn({ name: 'participation_id' })
  participation: Participation;
}