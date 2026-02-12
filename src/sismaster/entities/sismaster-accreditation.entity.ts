import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('accreditation', { database: 'sismaster' })
export class SismasterAccreditation {
  @PrimaryColumn({ name: 'idacreditation' })
  idacreditation: number;

  @Column({ name: 'idevent' })
  idevent: number;

  @Column({ name: 'idsport' })
  idsport: number;

  @Column({ name: 'idinstitution' })
  idinstitution: number;

  @Column({ name: 'idperson' })
  idperson: number;

  @Column({ name: 'idfunction' })
  idfunction: number;

  @Column({ type: 'varchar', length: 4, name: 'tregister' })
  tregister: string; 

  @Column({ type: 'varchar', length: 600, nullable: true })
  photo: string;

  @Column({ type: 'int', default: 0 })
  credential: number;

  @Column({ type: 'int', default: 1 })
  mstatus: number;
}
