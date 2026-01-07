import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Format } from './format.entity';

export type FieldType = 'text' | 'number' | 'date' | 'select';

@Entity('format_fields')
export class FormatField {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  label: string;

  @Column({ type: 'varchar', length: 20, default: 'text' })
  type: FieldType;

  @Column({ default: false })
  required: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  @ManyToOne(() => Format, (format) => format.fields, {
    onDelete: 'CASCADE',
  })
  format: Format;

  @Column()
  formatId: number;
}
