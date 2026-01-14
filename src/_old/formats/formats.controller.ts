import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { FormatsService } from './formats.service';
import { CreateFormatDto } from './dto/create-format.dto';

@Controller('formats')
export class FormatsController {
  constructor(private readonly formatsService: FormatsService) {}

  @Post()
  create(@Body() dto: CreateFormatDto) {
    return this.formatsService.create(dto);
  }

  @Get()
  findAll() {
    return this.formatsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.formatsService.findOne(id);
  }
}
