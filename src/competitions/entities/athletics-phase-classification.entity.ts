// src/competitions/entities/athletics-phase-classification.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';
import { Phase } from './phase.entity';
import { PhaseRegistration } from './phase-registration.entity';

@Entity('athletics_phase_classification')
@Unique('uq_apc_phase_reg', ['phaseRegistrationId'])
@Index(['phaseId'])
@Index(['phaseId', 'rankPosition'])
export class AthleticsPhaseClassification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'phase_id' })
  phaseId: number;

  @Column({ name: 'phase_registration_id' })
  phaseRegistrationId: number;

  @Column({ name: 'rank_position', type: 'tinyint', unsigned: true, nullable: true })
  rankPosition: number | null;

  @Column({ name: 'points_awarded', type: 'decimal', precision: 10, scale: 2, default: 0 })
  pointsAwarded: number;

  @Column({ name: 'is_scoring_eligible', type: 'boolean', default: true })
  isScoringEligible: boolean;

  @Column({ name: 'exclusion_reason', type: 'varchar', length: 255, nullable: true })
  exclusionReason: string | null;

  @Column({ name: 'final_time', type: 'varchar', length: 20, nullable: true })
  finalTime: string | null;

  @Column({ name: 'final_distance', type: 'decimal', precision: 8, scale: 3, nullable: true })
  finalDistance: number | null;

  @Column({ name: 'final_height', type: 'decimal', precision: 5, scale: 2, nullable: true })
  finalHeight: number | null;

  @Column({ name: 'final_iaaf_points', type: 'int', nullable: true })
  finalIaafPoints: number | null;

  @Column({
    name: 'result_source',
    type: 'enum',
    enum: ['finales', 'mejor_serie', 'mejor_intento', 'iaaf_points', 'manual'],
    nullable: true,
  })
  resultSource: 'finales' | 'mejor_serie' | 'mejor_intento' | 'iaaf_points' | 'manual' | null;

  @UpdateDateColumn({ name: 'classified_at' })
  classifiedAt: Date;

  @ManyToOne(() => Phase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @ManyToOne(() => PhaseRegistration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phase_registration_id' })
  phaseRegistration: PhaseRegistration;
}