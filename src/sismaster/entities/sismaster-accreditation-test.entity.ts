import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('accreditation_test', { database: 'sismaster' })
export class SismasterAccreditationTest {
  @PrimaryColumn({ name: 'idacreditation' })
  idacreditation: number;

  @PrimaryColumn({ name: 'idtest' })
  idtest: number;

  @Column({ type: 'int', default: 1 })
  mstatus: number;
}
