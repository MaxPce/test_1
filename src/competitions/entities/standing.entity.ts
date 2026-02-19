import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Phase } from './phase.entity';
import { Registration } from '../../events/entities/registration.entity';


@Entity('standings')
@Index(['phaseId'])
@Index(['registrationId'])
@Index(['points'])
@Index(['phaseId', 'points', 'scoreDiff'])
@Unique('unique_phase_registration', ['phaseId', 'registrationId'])
export class Standing {
  @PrimaryGeneratedColumn({ name: 'standing_id' })
  standingId: number;

  @Column({ name: 'phase_id', comment: 'Fase/Grupo al que pertenece' })
  phaseId: number;

  @Column({ name: 'registration_id' })
  registrationId: number;

  @Column({ name: 'matches_played', default: 0 })
  matchesPlayed: number;

  @Column({ default: 0 })
  wins: number;

  @Column({ default: 0 })
  draws: number;

  @Column({ default: 0 })
  losses: number;

  @Column({
    type: 'decimal',
    precision: 4,
    scale: 1,
    default: 0,
    comment: 'Victoria=1, Empate=0.5, Derrota=0',
  })
  points: number;

  @Column({ name: 'score_for', default: 0 })
  scoreFor: number;

  @Column({ name: 'score_against', default: 0 })
  scoreAgainst: number;

  @Column({ name: 'score_diff', default: 0 })
  scoreDiff: number;

  @Column({ name: 'rank_position', nullable: true })
  rankPosition: number;


  @Column({
    name: 'manual_rank_position',
    type: 'int',
    nullable: true,
    default: null,
    comment: 'Puesto asignado manualmente por el admin (sobreescribe cálculo automático)',
  })
  manualRankPosition: number | null;

  @Column({
    name: 'manual_rank_updated_at',
    type: 'timestamp',
    nullable: true,
    default: null,
    comment: 'Última vez que se actualizó el puesto manual',
  })
  manualRankUpdatedAt: Date | null;


  @ManyToOne(() => Phase, (phase) => phase.standings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @ManyToOne(() => Registration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;
}
