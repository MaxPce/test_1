import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Format } from '../entities/format.entity';
import { CreateFormatDto } from './dto/create-format.dto';

@Injectable()
export class FormatsService {
  constructor(
    @InjectRepository(Format)
    private readonly formatRepo: Repository<Format>,
  ) {}

  async create(dto: CreateFormatDto) {
    const format = this.formatRepo.create({
      name: dto.name,
      isActive: dto.isActive ?? true,
      fields: dto.fields?.map((f, idx) => ({
        label: f.label,
        type: f.type ?? 'text',
        required: f.required ?? false,
        order: f.order ?? idx,
      })),
    });

    return this.formatRepo.save(format);
  }

  async findAll() {
    return this.formatRepo.find({
      relations: { fields: true },
      order: { id: 'DESC', fields: { order: 'ASC' } as any },
    });
  }

  async findOne(id: number) {
    const format = await this.formatRepo.findOne({
      where: { id },
      relations: { fields: true },
      order: { fields: { order: 'ASC' } as any },
    });

    if (!format) throw new NotFoundException('Formato no encontrado');
    return format;
  }
}
