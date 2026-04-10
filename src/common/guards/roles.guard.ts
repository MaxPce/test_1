import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import { OperatorPermissionsService } from '../../operator-permissions/operator-permissions.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
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

    // ADMIN, MODERATOR, VIEWER pasan directo si su rol está listado
    const hasDirectRole = requiredRoles.some((role) => user.role === role);
    if (hasDirectRole) return true;

    // Lógica especial para OPERATOR
    if (user.role === UserRole.OPERATOR) {
      // si la ruta no permite operators, denegar inmediatamente
      if (!requiredRoles.includes(UserRole.OPERATOR)) {
        throw new ForbiddenException('No tienes permisos para realizar esta acción');
      }

      const permService = this.moduleRef.get(OperatorPermissionsService, {
        strict: false,
      });

      
      const eventId = this.extractEventId(params);
      const sportId = this.extractSportId(params);

      
      if (eventId !== undefined && sportId !== undefined) {
        const canAccess = await permService.canAccessSportInEvent(user.userId, eventId, sportId);
        if (!canAccess) {
          throw new ForbiddenException('No tienes acceso a este deporte en este evento');
        }
        return true;
      }

      if (eventId !== undefined) {
        const canAccess = await permService.canAccessEvent(user.userId, eventId);
        if (!canAccess) {
          throw new ForbiddenException('No tienes acceso a este evento');
        }
        return true;
      }

      if (sportId !== undefined) {
        const canAccess = await permService.canAccessSport(user.userId, sportId);
        if (!canAccess) {
          throw new ForbiddenException('No tienes acceso a este deporte');
        }
        return true;
      }

      
      return true;
    }

    throw new ForbiddenException('No tienes permisos para realizar esta acción');
  }

  
  private extractEventId(params: Record<string, string>): number | undefined {
    const raw =
      params?.eventId ??
      params?.sismasterEventId ??
      params?.externalEventId ??
      params?.idevent;
    const num = raw !== undefined ? Number(raw) : undefined;
    return num !== undefined && !isNaN(num) ? num : undefined;
  }

  
  private extractSportId(params: Record<string, string>): number | undefined {
    const raw =
      params?.sportId ??
      params?.externalSportId ??
      params?.localSportId;
    const num = raw !== undefined ? Number(raw) : undefined;
    return num !== undefined && !isNaN(num) ? num : undefined;
  }
}