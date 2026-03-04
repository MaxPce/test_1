import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('eventssports')
export class SismasterEventSport {
  @PrimaryGeneratedColumn()
  idevsport: number;

  @Column()
  idevent: number;

  @Column()
  idsport: number;

  @Column()
  idinstitution: number;

  @Column({ default: 1 })
  mstatus: number;
}
