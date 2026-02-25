import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Phase } from './phase.entity';
import { Registration } from '../../events/entities/registration.entity';

@Entity('phase_registrations')
@Unique('unique_phase_registration', ['phaseId', 'registrationId'])
@Index(['phaseId'])
export class PhaseRegistration {
  @PrimaryGeneratedColumn({ name: 'phase_registration_id' })
  phaseRegistrationId: number;

  @Column({ name: 'phase_id' })
  phaseId: number;

  @Column({ name: 'registration_id' })
  registrationId: number;

  @ManyToOne(() => Phase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phase_id' })
  phase: Phase;

  @ManyToOne(() => Registration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;
}
