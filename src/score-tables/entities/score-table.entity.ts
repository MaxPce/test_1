// src/score-tables/entities/score-table.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';
import { PhaseGender, PhaseLevel } from '../../common/enums';

@Entity('score_table')
@Index(['eventId'])
@Index(['eventId', 'institutionId'])
@Unique('uq_score_per_category', ['eventId', 'institutionId', 'gender', 'level'])
export class ScoreTable {
  @PrimaryGeneratedColumn({ name: 'score_table_id' })
  scoreTableId: number;

  @Column({ name: 'event_id' })
  eventId: number;

  @Column({ name: 'institution_id' })
  institutionId: number;

  @Column({ name: 'external_institution_id', type: 'int', nullable: true })
    externalInstitutionId: number | null;

  @Column({ name: 'institution_name', length: 255 })
  institutionName: string;

  @Column({ type: 'enum', enum: PhaseGender, nullable: true })
  gender: PhaseGender | null;

  @Column({ type: 'enum', enum: PhaseLevel, nullable: true })
  level: PhaseLevel | null;

  @Column({ name: 'total_points', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPoints: number;

  @Column({ name: 'gold_count', default: 0 })
  goldCount: number;

  @Column({ name: 'silver_count', default: 0 })
  silverCount: number;

  @Column({ name: 'bronze_count', default: 0 })
  bronzeCount: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;
}