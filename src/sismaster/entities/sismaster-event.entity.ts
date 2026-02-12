import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('events', { database: 'sismaster' })
export class SismasterEvent {
  @PrimaryColumn({ name: 'idevent' })
  idevent: number;

  @Column({ name: 'idseat', type: 'int' })
  idseat: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 3, nullable: true })
  tipo: string;

  @Column({ type: 'int', nullable: true })
  level: number;

  @Column({ type: 'varchar', length: 1 })
  modality: string;

  @Column({ type: 'int' })
  periodo: number;

  @Column({ type: 'datetime' })
  startdate: Date;

  @Column({ type: 'datetime' })
  enddate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  place: string;

  @Column({ type: 'varchar', length: 200 })
  logo: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  slug: string;

  @Column({ type: 'int', default: 1 })
  mstatus: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'datetime', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
