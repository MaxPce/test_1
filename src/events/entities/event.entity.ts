import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EventCategory } from './event-category.entity';
import { EventStatus } from '../../common/enums';
import { Company } from '../../companies/entities/company.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn({ name: 'event_id' })
  eventId: number;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ length: 200, nullable: true })
  location: string;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.PROGRAMADO,
    nullable: true,
  })
  status: EventStatus;

  @Column({ name: 'logo_url', length: 255, nullable: true })
  logoUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: number;

  @Column({ name: 'company_id', nullable: true })
  companyId: number;

  @ManyToOne(() => Company, (company) => company.events, { nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @OneToMany(() => EventCategory, (eventCategory) => eventCategory.event)
  eventCategories: EventCategory[];
}
