import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { AthleticsSection } from './athletics-section.entity';
import { PhaseRegistration } from './phase-registration.entity';

@Entity('athletics_section_entry')
export class AthleticsSectionEntry {
  @PrimaryGeneratedColumn({ name: 'entry_id' })
  entryId: number;

  @Column({ name: 'athletics_section_id' })
  athleticsSectionId: number;

  @Column({ name: 'phase_registration_id' })
  phaseRegistrationId: number;

  @Column({ type: 'tinyint', nullable: true })
  lane: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  time: string | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  wind: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => AthleticsSection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athletics_section_id' })
  athleticsSection: AthleticsSection;

  @ManyToOne(() => PhaseRegistration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phase_registration_id' })
  phaseRegistration: PhaseRegistration;
}
