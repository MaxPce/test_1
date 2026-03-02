import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, ParseIntPipe,
} from '@nestjs/common';
import { FeaturedAthletesService } from './services/featured-athletes.service';
import { CreateFeaturedAthleteDto } from './dto/create-featured-athlete.dto';
import { UpdateFeaturedAthleteDto } from './dto/update-featured-athlete.dto';

@Controller('featured-athletes')
export class FeaturedAthletesController {
  constructor(private readonly service: FeaturedAthletesService) {}

  @Post()
  create(@Body() dto: CreateFeaturedAthleteDto) {
    return this.service.create(dto);
  }

  @Get('event-category/:eventCategoryId')
  findByCategory(@Param('eventCategoryId', ParseIntPipe) id: number) {
    return this.service.findByEventCategory(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeaturedAthleteDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
