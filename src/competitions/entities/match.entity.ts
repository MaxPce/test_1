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
  DeleteDateColumn
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
@Index(['seriesId'])
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
  winnerRegistrationId?: number;

  @Column({ name: 'scheduled_time', type: 'datetime', nullable: true })
  scheduledTime: Date;

  @Column({
    name: 'platform_number',
    nullable: true,
    comment: 'Tatami/Plataforma',
  })
  platformNumber: number;

  @Column({
    name: 'participant1_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Puntaje total del participante 1',
  })
  participant1Score?: number;

  @Column({
    name: 'participant1_accuracy',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Accuracy del participante 1 (Poomsae)',
  })
  participant1Accuracy?: number;

  @Column({
    name: 'participant1_presentation',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Presentation del participante 1 (Poomsae)',
  })
  participant1Presentation?: number;

  @Column({
    name: 'participant2_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Puntaje total del participante 2',
  })
  participant2Score?: number;

  @Column({
    name: 'participant2_accuracy',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Accuracy del participante 2 (Poomsae)',
  })
  participant2Accuracy?: number;

  @Column({
    name: 'participant2_presentation',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Presentation del participante 2 (Poomsae)',
  })
  participant2Presentation?: number;

  @Column({
    name: 'series_id',
    nullable: true,
    comment: 'ID único para agrupar matches de una serie (Mejor de 3)',
  })
  seriesId: string;

  @Column({
    name: 'series_match_number',
    nullable: true,
  })
  seriesMatchNumber: number;

  @Column({
    name: 'series_winner_registration_id',
    nullable: true,
    comment: 'Ganador de toda la serie',
  })
  seriesWinnerRegistrationId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: number;

  @Column({
    name: 'is_walkover',
    type: 'boolean',
    default: false,
    comment: 'Indica si el match fue ganado por walkover (WO)',
  })
  isWalkover: boolean;

  @Column({
    name: 'walkover_reason',
    length: 255,
    nullable: true,
    comment: 'Razón del walkover: no_show, retired, disqualified, etc.',
  })
  walkoverReason?: string;


  @ManyToOne(() => Phase, (phase) => phase.matches)
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @ManyToOne(() => Registration)
  @JoinColumn({ name: 'winner_registration_id' })
  winner: Registration;

  @ManyToOne(() => Registration)
  @JoinColumn({ name: 'series_winner_registration_id' })
  seriesWinner: Registration;

  @OneToMany(() => Participation, (participation) => participation.match)
  participations: Participation[];
}
