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
import { PhaseRegistration } from './phase-registration.entity';
import { AthleticsSection } from './athletics-section.entity';

export enum HeightResult {
  O = 'O',
  X = 'X',
  SKIP = '-',
}

@Entity('athletics_result')
@Index(['phaseRegistrationId'])
@Index(['phaseRegistrationId', 'attemptNumber'])
export class AthleticsResult {
  @PrimaryGeneratedColumn({ name: 'athletics_result_id' })
  athleticsResultId: number;

  @Column({ name: 'phase_registration_id' })
  phaseRegistrationId: number;

  // ── Carreras (track) ──────────────────────────────
  @Column({ name: 'time', type: 'varchar', length: 20, nullable: true })
  time: string | null;

  @Column({ name: 'lane', type: 'tinyint', nullable: true })
  lane: number | null;

  // ── Saltos de distancia y lanzamientos ────────────
  @Column({ name: 'attempt_number', type: 'tinyint', nullable: true })
  attemptNumber: number | null;

  @Column({
    name: 'distance_value',
    type: 'decimal',
    precision: 8,
    scale: 3,
    nullable: true,
  })
  distanceValue: number | null;

  @Column({ name: 'is_valid', type: 'tinyint', width: 1, default: 1 })
  isValid: boolean;

  @Column({
    name: 'wind',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  wind: number | null;

  // ── Salto alto / garrocha ─────────────────────────
  @Column({
    name: 'height',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  height: number | null;

  @Column({
    name: 'height_result',
    type: 'enum',
    enum: HeightResult,
    nullable: true,
  })
  heightResult: HeightResult | null;

  // ── Heptatlón / Decatlón ──────────────────────────
  @Column({
    name: 'combined_event',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  combinedEvent: string | null;

  @Column({
    name: 'raw_value',
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
  })
  rawValue: number | null;

  @Column({ name: 'iaaf_points', type: 'int', nullable: true })
  iaafPoints: number | null;

  // ── Metadata ──────────────────────────────────────
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => PhaseRegistration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phase_registration_id' })
  phaseRegistration: PhaseRegistration;
}
