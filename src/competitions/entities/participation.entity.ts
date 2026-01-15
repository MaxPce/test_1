import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Match } from './match.entity';
import { Registration } from '../../events/entities/registration.entity';
import { Corner } from '../../common/enums';

@Entity('participations')
@Index(['matchId'])
@Index(['registrationId'])
@Unique('unique_match_registration', ['matchId', 'registrationId'])
export class Participation {
  @PrimaryGeneratedColumn({ name: 'participation_id' })
  participationId: number;

  @Column({ name: 'match_id', nullable: true })
  matchId: number | null;

  @Column({ name: 'registration_id', nullable: true })
  registrationId: number | null;

  @Column({
    type: 'enum',
    enum: Corner,
    nullable: true,
    comment: 'Esquina/Color del competidor',
  })
  corner: Corner | null;

  @ManyToOne(() => Match, (match) => match.participations)
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @ManyToOne(() => Registration)
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;
}
