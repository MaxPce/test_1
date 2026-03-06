import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('sport_params') 
export class SismasterSportParam {
  @PrimaryGeneratedColumn()
  idparam: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20, nullable: true })
  abrev: string;

  @Column()
  idsport: number;

  @Column({ default: 0 })
  idfather: number;

  @Column({ length: 20, nullable: true })
  code: string;

  @Column({ default: 0 })
  isleaf: number;

  @Column({ type: 'datetime' })
  createdat: Date;
}
