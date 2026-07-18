import { Entity, Column } from 'typeorm';
import { SismasterSportParam } from '../../sismaster/entities/sismaster-sport-param.entity';

@Entity('sport_params')
export class HaymasterSportParam extends SismasterSportParam {
  @Column({ name: 'idcompany', type: 'int', nullable: true })
  idcompany: number | null;
}