import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  DeleteDateColumn
} from 'typeorm';
import { EventCategory } from '../../events/entities/event-category.entity';
import { Match } from './match.entity';
import { Standing } from './standing.entity';
import { PhaseType, PhaseGender, PhaseLevel } from '../../common/enums';

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

  @Column({ type: 'enum', enum: PhaseGender, nullable: true })
  gender: PhaseGender | null;

  @Column({ type: 'enum', enum: PhaseLevel, nullable: true })
  level: PhaseLevel | null;

  @Column({ name: 'is_relay', type: 'boolean', default: false })
  isRelay: boolean;

  @Column({ name: 'display_order', nullable: true })
  displayOrder: number;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: number;

  @ManyToOne(() => EventCategory)
  @JoinColumn({ name: 'event_category_id' })
  eventCategory: EventCategory;

  @OneToMany(() => Match, (match) => match.phase)
  matches: Match[];

  @OneToMany(() => Standing, (standing) => standing.phase)
  standings: Standing[];
}
