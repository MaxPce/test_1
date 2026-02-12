import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('sport', { database: 'sismaster' })
export class SismasterSport {
  @PrimaryColumn({ name: 'idsport' })
  idsport: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  acronym: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo: string;
}
