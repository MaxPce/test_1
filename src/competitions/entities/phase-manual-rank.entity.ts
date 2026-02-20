import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Phase } from './phase.entity';
import { Registration } from '../../events/entities/registration.entity';

@Entity('phase_manual_ranks')
@Unique(['phaseId', 'registrationId'])
export class PhaseManualRank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'phase_id' })
  phaseId: number;

  @Column({ name: 'registration_id' })
  registrationId: number;

  @Column({ name: 'manual_rank_position', type: 'int', nullable: true })
  manualRankPosition: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Phase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @ManyToOne(() => Registration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;
}
