import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { EventCategory } from './event-category.entity';
import { Registration } from './registration.entity';

@Entity('featured_athletes')
export class FeaturedAthlete {
  @PrimaryGeneratedColumn({ name: 'featured_athlete_id' })
  featuredAthleteId: number;

  @Column({ name: 'event_category_id' })
  eventCategoryId: number;

  @Column({ name: 'registration_id' })
  registrationId: number;

  @Column({ type: 'text' })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => EventCategory, { nullable: false })
  @JoinColumn({ name: 'event_category_id' })
  eventCategory: EventCategory;

  @ManyToOne(() => Registration, { nullable: false })
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;
}
