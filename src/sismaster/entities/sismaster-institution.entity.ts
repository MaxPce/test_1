import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('institution', { database: 'sismaster' })
export class SismasterInstitution {
  @PrimaryColumn({ name: 'idinstitution' })
  idinstitution: number;

  @Column({ type: 'int' })
  idseat: number;

  @Column({ type: 'varchar', length: 12 })
  ruc: string;

  @Column({ type: 'varchar', length: 200 })
  business: string;

  @Column({ type: 'varchar', length: 200, name: 'business_name' })
  businessName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  abrev: string;

  @Column({ type: 'varchar', length: 3 })
  category: string;

  @Column({ type: 'int' })
  instype: number;

  @Column({ type: 'varchar', length: 2, default: 'PE' })
  country: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  avatar: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  siteweb: string;

  @Column({ type: 'enum', enum: ['1', '0'] })
  afiliate: string;

  @Column({ type: 'int', default: 1 })
  mstatus: number;
}
