import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SportsService } from './sports.service';
import {
  CreateSportTypeDto,
  UpdateSportTypeDto,
  CreateSportDto,
  UpdateSportDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('sports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  // ==================== SPORT TYPES ====================

  @Post('types')
  @Roles(UserRole.ADMIN)
  createSportType(@Body() createDto: CreateSportTypeDto) {
    return this.sportsService.createSportType(createDto);
  }

  @Get('types')
  @Public()
  findAllSportTypes() {
    return this.sportsService.findAllSportTypes();
  }

  @Get('types/:id')
  @Public()
  findOneSportType(@Param('id', ParseIntPipe) id: number) {
    return this.sportsService.findOneSportType(id);
  }

  @Patch('types/:id')
  @Roles(UserRole.ADMIN)
  updateSportType(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSportTypeDto,
  ) {
    return this.sportsService.updateSportType(id, updateDto);
  }

  @Delete('types/:id')
  @Roles(UserRole.ADMIN)
  removeSportType(@Param('id', ParseIntPipe) id: number) {
    return this.sportsService.removeSportType(id);
  }

  // ==================== CATEGORIES (ANTES DE SPORTS) ====================

  @Post('categories')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createCategory(@Body() createDto: CreateCategoryDto) {
    return this.sportsService.createCategory(createDto);
  }

  @Get('categories')
  @Public()
  findAllCategories(
    @Query('sportId') sportId?: string,
    @Query('formatType') formatType?: string,
  ) {
    const sportIdNum = sportId ? parseInt(sportId, 10) : undefined;
    return this.sportsService.findAllCategories(sportIdNum, formatType);
  }

  @Get('categories/:id')
  @Public()
  findOneCategory(@Param('id', ParseIntPipe) id: number) {
    return this.sportsService.findOneCategory(id);
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCategoryDto,
  ) {
    return this.sportsService.updateCategory(id, updateDto);
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN)
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.sportsService.removeCategory(id);
  }

  // ==================== SPORTS (DESPUÉS DE CATEGORIES) ====================

  @Post()
  @Roles(UserRole.ADMIN)
  createSport(@Body() createDto: CreateSportDto) {
    return this.sportsService.createSport(createDto);
  }

  @Get()
  @Public()
  findAllSports(@Query('sportTypeId') sportTypeId?: string) {
    const sportTypeIdNum = sportTypeId ? parseInt(sportTypeId, 10) : undefined;
    return this.sportsService.findAllSports(sportTypeIdNum);
  }

  @Get(':id')
  @Public()
  findOneSport(@Param('id', ParseIntPipe) id: number) {
    return this.sportsService.findOneSport(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  updateSport(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSportDto,
  ) {
    return this.sportsService.updateSport(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  removeSport(@Param('id', ParseIntPipe) id: number) {
    return this.sportsService.removeSport(id);
  }
}
