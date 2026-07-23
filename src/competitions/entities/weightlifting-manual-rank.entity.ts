// src/competitions/entities/weightlifting-manual-rank.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Phase } from './phase.entity';
import { Registration } from '../../events/entities/registration.entity';

@Entity('weightlifting_manual_ranks')
@Unique(['phaseId', 'registrationId'])
export class WeightliftingManualRank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'phase_id' })
  phaseId: number;

  @Column({ name: 'registration_id' })
  registrationId: number;

  @Column({ name: 'snatch_rank', nullable: true, type: 'int' })
  snatchRank: number | null;

  @Column({ name: 'clean_and_jerk_rank', nullable: true, type: 'int' })
  cleanAndJerkRank: number | null;

  @Column({ name: 'total_rank', nullable: true, type: 'int' })
  totalRank: number | null;

  @ManyToOne(() => Phase)
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @ManyToOne(() => Registration)
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;
}