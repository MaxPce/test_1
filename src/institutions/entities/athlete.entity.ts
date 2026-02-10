import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { Institution } from './institution.entity';
import { TeamMember } from './team-member.entity';
import { Gender } from '../../common/enums';

@Entity('athletes')
@Index(['institutionId'])
@Index(['docNumber'])
export class Athlete {
  @PrimaryGeneratedColumn({ name: 'athlete_id' })
  athleteId: number;

  @Column({ name: 'institution_id', nullable: true })
  institutionId: number;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'date_birth', type: 'date', nullable: true })
  dateBirth: Date;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender: Gender;

  @Column({ length: 3, nullable: true, comment: 'Código ISO de 3 letras' })
  nationality: string;

  @Column({ name: 'photo_url', length: 255, nullable: true })
  photoUrl: string;

  @Column({ name: 'doc_number', length: 50, nullable: true })
  docNumber: string;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: number;

  @ManyToOne(() => Institution, (institution) => institution.athletes, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'institution_id' })
  institution: Institution;

  @OneToMany(() => TeamMember, (teamMember) => teamMember.athlete)
  teamMemberships: TeamMember[];
}
