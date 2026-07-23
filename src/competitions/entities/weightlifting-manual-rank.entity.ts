import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('weightlifting_phase_manual_ranks')
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

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}