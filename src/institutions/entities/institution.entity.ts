import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Athlete } from './athlete.entity';
import { Team } from './team.entity';

@Entity('institutions')
export class Institution {
  @PrimaryGeneratedColumn({ name: 'institution_id' })
  institutionId: number;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'logo_url', length: 255, nullable: true })
  logoUrl: string;

  @Column({ length: 10, nullable: true })
  abrev: string;

  @OneToMany(() => Athlete, (athlete) => athlete.institution)
  athletes: Athlete[];

  @OneToMany(() => Team, (team) => team.institution)
  teams: Team[];
}
