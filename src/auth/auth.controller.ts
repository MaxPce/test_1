import {
  Controller,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.userId);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  async findAll(@Query('role') role?: UserRole) {
    return this.authService.findAllUsers(role);
  }

  @Get('users/deleted')
  @Roles(UserRole.ADMIN)
  async findDeleted() {
    return this.authService.findDeletedUsers();
  }

  @Get('users/:id')
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.authService.findOneUser(id);
  }

  @Delete('users/:id')
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    await this.authService.removeUser(id, user.userId);
    return { message: 'Usuario eliminado correctamente' };
  }

  @Patch('users/:id/restore')
  @Roles(UserRole.ADMIN)
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.authService.restoreUser(id);
  }

  @Post('admins')
  @Roles(UserRole.ADMIN)
  async createAdmin(@Body() registerDto: RegisterDto) {
    return this.authService.createAdmin(registerDto);
  }

  @Patch('users/:id/password')
  @Roles(UserRole.ADMIN)
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authService.changePassword(id, changePasswordDto.newPassword, user.userId);
  }

  @Delete('users/:id/hard')
  @Roles(UserRole.ADMIN)
  async hardDelete(@Param('id', ParseIntPipe) id: number) {
    await this.authService.hardDeleteUser(id);
    return { message: 'Usuario eliminado permanentemente' };
  }
}
