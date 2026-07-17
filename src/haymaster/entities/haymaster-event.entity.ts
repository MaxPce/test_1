import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('events')
export class HaymasterEvent {
  @PrimaryColumn({ name: 'idevent' })
  idevent: number;

  @Column({ name: 'idseat', nullable: true })
  idseat: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 3, nullable: true })
  tipo: string;

  @Column({ type: 'int', nullable: true })
  level: number;

  @Column({ type: 'varchar', length: 1, nullable: true })
  modality: string;

  @Column({ type: 'int', nullable: true })
  periodo: number;

  @Column({ type: 'datetime', nullable: true })
  startdate: Date;

  @Column({ type: 'datetime', nullable: true })
  enddate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  place: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  logo: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  slug: string;

  @Column({ type: 'int', nullable: true })
  mstatus: number;

  @Column({ type: 'int', nullable: true })
  idcompany: number;

  @Column({ type: 'datetime', nullable: true })
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at: Date;
}