import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('sport_params', { database: 'sismaster' })
export class SismasterSportParam {
  @PrimaryColumn({ name: 'idparam' })
  idparam: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  abrev: string;

  @Column({ name: 'idsport' })
  idsport: number;

  @Column({ name: 'idfather', default: 0 })
  idfather: number;

  // ← VARCHAR(20), nullable — crítico, era incorrecto en el diseño anterior
  @Column({ type: 'varchar', length: 20, nullable: true })
  code: string;

  @Column({ name: 'isleaf', default: 0 })
  isleaf: number;
}
