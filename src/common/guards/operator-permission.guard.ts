import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { OperatorPermissionsService } from '../../operator-permissions/operator-permissions.service';
import {
  OPERATOR_RESOURCE_KEY,
  OperatorResourceConfig,
} from '../decorators/operator-resource.decorator';
import type { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class OperatorPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly operatorPermissionsService: OperatorPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    // Admin y moderador pasan siempre
    if (!user || user.role !== UserRole.OPERATOR) return true;

    // Leer config del decorador
    const config = this.reflector.getAllAndOverride<OperatorResourceConfig>(
      OPERATOR_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si el endpoint no tiene @OperatorResource, bloquear por defecto al operator
    if (!config) {
      throw new ForbiddenException(
        'Los operadores no tienen acceso a este recurso',
      );
    }

    const params = request.params;
    const eventId = config.eventParam ? Number(params[config.eventParam]) : null;
    const sportId = config.sportParam ? Number(params[config.sportParam]) : null;

    // Validar acceso
    const hasAccess = await this.operatorPermissionsService.canAccess(
      user.userId,
      eventId,
      sportId,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a este recurso',
      );
    }

    return true;
  }
}