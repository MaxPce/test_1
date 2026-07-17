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
@Index(['externalEventId'])
@Index(['haymasterEventId'])   // ← NUEVO índice
export class EventCategory {
  @PrimaryGeneratedColumn({ name: 'event_category_id' })
  eventCategoryId: number;

  @Column({ name: 'event_id', nullable: true })
  eventId: number | null;

  @Column({ name: 'category_id', nullable: true })
  categoryId: number | null;

  @Column({
    name: 'external_event_id',
    type: 'int',
    nullable: true,
    comment: 'ID del evento en sismaster.events',
  })
  externalEventId: number | null;

  @Column({
    name: 'haymaster_event_id',     // ← NUEVO
    type: 'int',
    nullable: true,
    comment: 'ID del evento en haymaster.events',
  })
  haymasterEventId: number | null;

  @Column({
    name: 'external_sport_id',
    type: 'int',
    nullable: true,
    comment: 'DEPRECADO: ID del deporte en sismaster.sport',
  })
  externalSportId: number | null;

  @Column({
    type: 'enum',
    enum: ['pendiente', 'en_curso', 'finalizado'],
    default: 'pendiente',
    nullable: true,
  })
  status: string;

  @Column({ name: 'external_sport_param_id', type: 'int', nullable: true })
  externalSportParamId: number | null;

  @ManyToOne(() => Event, (event) => event.eventCategories, { nullable: true })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany(() => Registration, (registration) => registration.eventCategory)
  registrations: Registration[];
}