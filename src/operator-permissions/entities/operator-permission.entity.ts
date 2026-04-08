import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('operator_permissions')
export class OperatorPermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'sport_id', nullable: true, type: 'int' })
  sportId: number | null;

  
  @Column({ name: 'event_id', nullable: true, type: 'int' })
  eventId: number | null;

  // identifica si el evento es local o de Sismaster
  @Column({
    name: 'event_source',
    type: 'enum',
    enum: ['local', 'sismaster'],
    nullable: true,
  })
  eventSource: 'local' | 'sismaster' | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}