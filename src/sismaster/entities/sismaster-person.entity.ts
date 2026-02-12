import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('person', { database: 'sismaster' })
export class SismasterPerson {
  @PrimaryColumn({ name: 'idperson' })
  idperson: number;

  @Column({ type: 'int' })
  doctype: number;

  @Column({ type: 'varchar', length: 15 })
  docnumber: string;

  @Column({ type: 'varchar', length: 50 })
  firstname: string;

  @Column({ type: 'varchar', length: 50 })
  lastname: string;

  @Column({ type: 'varchar', length: 50 })
  surname: string;

  @Column({ type: 'enum', enum: ['M', 'F', 'I', 'N'] })
  gender: string;

  @Column({ type: 'date' })
  birthday: Date;

  @Column({ type: 'varchar', length: 150, nullable: true })
  birthday_place: string;

  @Column({ type: 'varchar', length: 12 })
  phone1: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  phone2: string;

  @Column({ type: 'varchar', length: 100 })
  email1: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email2: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  country: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'int', default: 1 })
  mstatus: number;
}
