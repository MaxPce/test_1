import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Phase } from './phase.entity';

@Entity('athletics_section')
export class AthleticsSection {
  @PrimaryGeneratedColumn({ name: 'athletics_section_id' })
  athleticsSectionId: number;

  @Column({ name: 'phase_id' })
  phaseId: number;

  @ManyToOne(() => Phase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({
    name: 'wind',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  wind: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
