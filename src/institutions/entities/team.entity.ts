import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Institution } from './institution.entity';
import { Category } from '../../sports/entities/category.entity';
import { TeamMember } from './team-member.entity';

@Entity('teams')
@Index(['institutionId'])
@Index(['categoryId'])
export class Team {
  @PrimaryGeneratedColumn({ name: 'team_id' })
  teamId: number;

  @Column({ length: 200, nullable: true })
  name: string;

  @Column({ name: 'institution_id' })
  institutionId: number;

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => Institution, (institution) => institution.teams)
  @JoinColumn({ name: 'institution_id' })
  institution: Institution;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany(() => TeamMember, (teamMember) => teamMember.team)
  members: TeamMember[];
}
