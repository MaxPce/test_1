import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { EventCategory } from './event-category.entity';
import { Athlete } from '../../institutions/entities/athlete.entity';
import { Team } from '../../institutions/entities/team.entity';

@Entity('registrations')
@Index(['eventCategoryId'])
@Index(['athleteId'])
@Index(['teamId'])
@Index(['eventCategoryId', 'athleteId'])
@Index(['eventCategoryId', 'teamId'])
@Check(
  `(athlete_id IS NOT NULL AND team_id IS NULL) OR (athlete_id IS NULL AND team_id IS NOT NULL)`,
)
export class Registration {
  @PrimaryGeneratedColumn({ name: 'registration_id' })
  registrationId: number;

  @Column({ name: 'event_category_id', nullable: true })
  eventCategoryId: number;

  @Column({
    name: 'athlete_id',
    nullable: true,
    comment: 'Para competencias individuales',
  })
  athleteId: number;

  @Column({
    name: 'team_id',
    nullable: true,
    comment: 'Para competencias por equipos',
  })
  teamId: number;

  @Column({ name: 'seed_number', nullable: true, comment: 'Cabeza de serie' })
  seedNumber: number;

  @ManyToOne(
    () => EventCategory,
    (eventCategory) => eventCategory.registrations,
  )
  @JoinColumn({ name: 'event_category_id' })
  eventCategory: EventCategory;

  @ManyToOne(() => Athlete)
  @JoinColumn({ name: 'athlete_id' })
  athlete: Athlete;

  @ManyToOne(() => Team)
  @JoinColumn({ name: 'team_id' })
  team: Team;
}
