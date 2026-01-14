import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Team } from './team.entity';
import { Athlete } from './athlete.entity';

@Entity('team_members')
@Index(['teamId'])
@Index(['athleteId'])
export class TeamMember {
  @PrimaryGeneratedColumn({ name: 'tm_id' })
  tmId: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @Column({ name: 'athlete_id' })
  athleteId: number;

  @Column({ length: 50, nullable: true, comment: 'titular, suplente, capitan' })
  rol: string;

  @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @ManyToOne(() => Athlete, (athlete) => athlete.teamMemberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'athlete_id' })
  athlete: Athlete;
}
