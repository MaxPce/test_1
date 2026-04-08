import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OperatorPermissionsService } from './operator-permissions.service';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

@Controller('operator-permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperatorPermissionsController {
  constructor(private readonly service: OperatorPermissionsService) {}

  // Solo admin puede asignar permisos
  @Post()
  @Roles(UserRole.ADMIN)
  async assign(@Body() dto: AssignPermissionDto) {
    return this.service.assign(dto);
  }

  // Solo admin puede revocar permisos
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Permiso revocado correctamente' };
  }

  // Admin puede ver permisos de cualquier usuario
  @Get('user/:userId')
  @Roles(UserRole.ADMIN)
  async getByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.getByUser(userId);
  }

  // Admin puede ver resumen de permisos
  @Get('user/:userId/summary')
  @Roles(UserRole.ADMIN)
  async getSummary(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.getSummaryByUser(userId);
  }

  // El operator puede ver sus propios permisos (para cargar en el frontend al login)
  @Get('my-permissions')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.OPERATOR)
  async getMyPermissions(@CurrentUser() user: AuthUser) {
    return this.service.getSummaryByUser(user.userId);
  }
}