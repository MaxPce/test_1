import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { SportType } from './sport-type.entity';
import { Category } from './category.entity';

@Entity('sports')
@Index(['sportTypeId'])
export class Sport {
  @PrimaryGeneratedColumn({ name: 'sport_id' })
  sportId: number;

  @Column({ name: 'sport_type_id' })
  sportTypeId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'icon_url', length: 255, nullable: true })
  iconUrl: string;

  @ManyToOne(() => SportType, (sportType) => sportType.sports)
  @JoinColumn({ name: 'sport_type_id' })
  sportType: SportType;

  @OneToMany(() => Category, (category) => category.sport)
  categories: Category[];
}
