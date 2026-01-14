import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Event } from './event.entity';
import { Category } from '../../sports/entities/category.entity';
import { Registration } from './registration.entity';

@Entity('event_categories')
@Index(['eventId'])
@Index(['categoryId'])
export class EventCategory {
  @PrimaryGeneratedColumn({ name: 'event_category_id' })
  eventCategoryId: number;

  @Column({ name: 'event_id', nullable: true })
  eventId: number;

  @Column({ name: 'category_id', nullable: true })
  categoryId: number;

  @Column({
    type: 'enum',
    enum: ['pendiente', 'en_curso', 'finalizado'],
    default: 'pendiente',
    nullable: true,
  })
  status: string;

  @ManyToOne(() => Event, (event) => event.eventCategories)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany(() => Registration, (registration) => registration.eventCategory)
  registrations: Registration[];
}
