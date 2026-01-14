import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Sport } from './sport.entity';

@Entity('sport_type')
export class SportType {
  @PrimaryGeneratedColumn({ name: 'sport_type_id' })
  sportTypeId: number;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ length: 255, nullable: true })
  description: string;

  @OneToMany(() => Sport, (sport) => sport.sportType)
  sports: Sport[];
}
