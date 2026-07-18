import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('sport_params')
export class HaymasterSportParam {
  @PrimaryGeneratedColumn()
  idparam: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  abrev: string | null;

  @Column({ type: 'int' })
  idsport: number;

  @Column({ type: 'int', default: 0 })
  idfather: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  code: string | null;

  @Column({ type: 'int', default: 0 })
  isleaf: number;

  @Column({ name: 'idcompany', type: 'int', nullable: true })
  idcompany: number | null;

  @Column({ name: 'created_at', type: 'datetime', nullable: true })
  createdAt: Date;
}