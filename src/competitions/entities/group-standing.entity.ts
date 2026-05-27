import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Phase } from './phase.entity';
import { Registration } from '../../events/entities/registration.entity';

@Entity('group_standings')
@Index(['phaseId'])
export class GroupStanding {
  @PrimaryGeneratedColumn({ name: 'group_standing_id' })
  groupStandingId: number;

  @Column({ name: 'phase_id' })
  phaseId: number;

  @Column({ name: 'registration_id' })
  registrationId: number;

  @Column({ default: 0 })
  played: number;

  @Column({ default: 0 })
  won: number;

  @Column({ default: 0 })
  drawn: number;

  @Column({ default: 0 })
  lost: number;

  @Column({ name: 'points_for', default: 0 })
  pointsFor: number;

  @Column({ name: 'points_against', default: 0 })
  pointsAgainst: number;

  @Column({ name: 'point_difference', default: 0 })
  pointDifference: number;

  @Column({ default: 0 })
  points: number;

  @Column({ name: 'qualified', type: 'boolean', default: false })
  qualified: boolean;

  @Column({ name: 'final_rank', type: 'int', nullable: true })
  finalRank: number | null;

  @ManyToOne(() => Phase)
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @ManyToOne(() => Registration)
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;
}