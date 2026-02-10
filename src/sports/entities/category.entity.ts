import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  DeleteDateColumn
} from 'typeorm';
import { Sport } from './sport.entity';
import {
  FormatType,
  ResultType,
  Gender,
  CategoryType,
} from '../../common/enums';

@Entity('categories')
@Index(['sportId'])
export class Category {
  @PrimaryGeneratedColumn({ name: 'category_id' })
  categoryId: number;

  @Column({ name: 'sport_id', nullable: true })
  sportId: number;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({
    name: 'format_type',
    type: 'enum',
    enum: FormatType,
  })
  formatType: FormatType;

  @Column({
    name: 'result_type',
    type: 'enum',
    enum: ResultType,
  })
  resultType: ResultType;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender: Gender;

  @Column({
    name: 'weight_min',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  weightMin: number;

  @Column({
    name: 'weight_max',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  weightMax: number;

  @Column({
    type: 'enum',
    enum: CategoryType,
    default: CategoryType.INDIVIDUAL,
  })
  type: CategoryType;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: number;

  @ManyToOne(() => Sport, (sport) => sport.categories)
  @JoinColumn({ name: 'sport_id' })
  sport: Sport;
}
