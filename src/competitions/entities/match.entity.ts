import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Phase } from './phase.entity';
import { Registration } from '../../events/entities/registration.entity';
import { Participation } from './participation.entity';
import { MatchStatus } from '../../common/enums';

@Entity('matches')
@Index(['phaseId'])
@Index(['status'])
@Index(['winnerRegistrationId'])
@Index(['phaseId', 'status'])
export class Match {
  @PrimaryGeneratedColumn({ name: 'match_id' })
  matchId: number;

  @Column({ name: 'phase_id', nullable: true })
  phaseId: number;

  @Column({ name: 'match_number', nullable: true })
  matchNumber: number;

  @Column({
    length: 50,
    nullable: true,
    comment: 'Para eliminación: final, semi, cuartos',
  })
  round: string;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.PROGRAMADO,
    nullable: true,
  })
  status: MatchStatus;

  @Column({ name: 'winner_registration_id', nullable: true })
  winnerRegistrationId?: number; // ✅ Usar ? en lugar de | null

  @Column({ name: 'scheduled_time', type: 'datetime', nullable: true })
  scheduledTime: Date;

  @Column({
    name: 'platform_number',
    nullable: true,
    comment: 'Tatami/Plataforma',
  })
  platformNumber: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Phase, (phase) => phase.matches)
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @ManyToOne(() => Registration)
  @JoinColumn({ name: 'winner_registration_id' })
  winner: Registration;

  @OneToMany(() => Participation, (participation) => participation.match)
  participations: Participation[];
}
