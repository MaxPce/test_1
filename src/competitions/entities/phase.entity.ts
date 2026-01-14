import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { EventCategory } from '../../events/entities/event-category.entity';
import { Match } from './match.entity';
import { Standing } from './standing.entity';
import { PhaseType } from '../../common/enums';

@Entity('phases')
@Index(['eventCategoryId'])
export class Phase {
  @PrimaryGeneratedColumn({ name: 'phase_id' })
  phaseId: number;

  @Column({ name: 'event_category_id', nullable: true })
  eventCategoryId: number;

  @Column({
    length: 100,
    nullable: true,
    comment: 'Ej: Pool A, Cuartos, Repechaje',
  })
  name: string;

  @Column({
    type: 'enum',
    enum: PhaseType,
  })
  type: PhaseType;

  @Column({ name: 'display_order', nullable: true })
  displayOrder: number;

  @ManyToOne(() => EventCategory)
  @JoinColumn({ name: 'event_category_id' })
  eventCategory: EventCategory;

  @OneToMany(() => Match, (match) => match.phase)
  matches: Match[];

  @OneToMany(() => Standing, (standing) => standing.phase)
  standings: Standing[];
}
