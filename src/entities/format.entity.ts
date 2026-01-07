import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { FormatField } from './format-field.entity';
  
  @Entity('formats')
  export class Format {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column({ length: 120 })
    name: string;
  
    @Column({ default: true })
    isActive: boolean;
  
    @OneToMany(() => FormatField, (field) => field.format, {
      cascade: true,
    })
    fields: FormatField[];
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }
  