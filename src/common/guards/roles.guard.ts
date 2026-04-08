import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
// ✅ Import estático normal — TypeScript lo resuelve bien
import { OperatorPermissionsService } from '../../operator-permissions/operator-permissions.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef, // ✅ Para resolver el servicio en runtime
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) return true;

    const { user, params } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Admin / moderator / viewer pasan directo si están en requiredRoles
    const hasDirectRole = requiredRoles.some((role) => user.role === role);
    if (hasDirectRole) return true;

    // Lógica especial para operator
    if (user.role === UserRole.OPERATOR) {
      // strict: false → busca el servicio en todos los módulos registrados globalmente
      const permService = this.moduleRef.get(OperatorPermissionsService, {
        strict: false,
      });

      const sportId = params?.sportId ? Number(params.sportId) : undefined;
      const eventId = params?.eventId ? Number(params.eventId) : undefined;

      if (eventId) {
        const canAccess = await permService.canAccessEvent(user.userId, eventId);
        if (!canAccess) {
          throw new ForbiddenException('No tienes acceso a este evento');
        }
        return true;
      }

      if (sportId) {
        const canAccess = await permService.canAccessSport(user.userId, sportId);
        if (!canAccess) {
          throw new ForbiddenException('No tienes acceso a este deporte');
        }
        return true;
      }

      // Sin params específicos: pasa si operator está en los roles requeridos
      if (requiredRoles.includes(UserRole.OPERATOR)) return true;
    }

    throw new ForbiddenException('No tienes permisos para realizar esta acción');
  }
}