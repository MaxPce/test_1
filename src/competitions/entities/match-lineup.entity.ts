import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Participation } from './participation.entity';
import { Athlete } from '../../institutions/entities/athlete.entity';

@Entity('match_lineups')
@Index(['participationId'])
@Index(['athleteId'])
export class MatchLineup {
  @PrimaryGeneratedColumn({ name: 'lineup_id' })
  lineupId: number;

  @Column({ name: 'participation_id' })
  participationId: number;

  @Column({ name: 'athlete_id' })
  athleteId: number;

  @Column({
    name: 'lineup_order',
    type: 'tinyint',
    comment: 'Posición: A=1, B=2, C=3, Suplente=4',
  })
  lineupOrder: number;

  @Column({
    name: 'is_substitute',
    type: 'boolean',
    default: false,
  })
  isSubstitute: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => Participation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participation_id' })
  participation: Participation;

  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athlete_id' })
  athlete: Athlete;
}
