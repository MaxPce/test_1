import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm'; // ✅ Importar IsNull
import { OperatorPermission } from './entities/operator-permission.entity';
import { AssignPermissionDto } from './dto/assign-permission.dto';

@Injectable()
export class OperatorPermissionsService {
  constructor(
    @InjectRepository(OperatorPermission)
    private readonly repo: Repository<OperatorPermission>,
  ) {}

  async assign(dto: AssignPermissionDto): Promise<OperatorPermission> {
    if (!dto.sportId && !dto.eventId) {
      throw new BadRequestException(
        'Debes especificar al menos un deporte o un evento',
      );
    }

    const existing = await this.repo.findOne({
      where: {
        userId: dto.userId,
        sportId: dto.sportId !== undefined ? dto.sportId : IsNull(),
        eventId: dto.eventId !== undefined ? dto.eventId : IsNull(),
      },
    });

    if (existing) {
      throw new ConflictException('Este permiso ya existe para el usuario');
    }

    const permission = this.repo.create({
      userId:      dto.userId,
      sportId:     dto.sportId     ?? null,
      eventId:     dto.eventId     ?? null,
      eventSource: dto.eventSource ?? null,  
    });

    return this.repo.save(permission);
  }

  async remove(id: number): Promise<void> {
    const permission = await this.repo.findOne({ where: { id } });
    if (!permission) {
      throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
    }
    await this.repo.delete(id);
  }

  async removeAllByUser(userId: number): Promise<void> {
    await this.repo.delete({ userId });
  }

  async getByUser(userId: number): Promise<OperatorPermission[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async canAccessEvent(userId: number, eventId: number): Promise<boolean> {
    const perms = await this.repo.find({ where: { userId } });
    return perms.some((p) => p.eventId === eventId); 
  }


  async canAccessSport(userId: number, sportId: number): Promise<boolean> {
    const perms = await this.repo.find({ where: { userId } });
    return perms.some((p) => p.sportId === sportId && p.eventId === null);
  }

  async canAccessSportInEvent(
    userId: number,
    eventId: number,
    sportId: number,
  ): Promise<boolean> {
    const perms = await this.repo.find({ where: { userId } });
    return perms.some(
      (p) =>
        p.eventId === eventId ||                              
        (p.sportId === sportId && p.eventId === null),        
    );
  }


  async getSummaryByUser(userId: number) {
    const perms = await this.repo.find({ where: { userId } });
    return {
      sportIds: perms
        .filter((p) => p.sportId !== null && p.eventId === null)
        .map((p) => p.sportId as number),
      eventIds: perms
        .filter((p) => p.eventId !== null)
        .map((p) => p.eventId as number),
      permissions: perms,
    };
  }

  async canAccess(
    userId: number,
    eventId: number | null,
    sportId: number | null,
  ): Promise<boolean> {
    // Ambos presentes → validar la relación sport dentro del evento
    if (eventId !== null && sportId !== null) {
      return this.canAccessSportInEvent(userId, eventId, sportId);
    }
    // Solo eventId
    if (eventId !== null) {
      return this.canAccessEvent(userId, eventId);
    }
    // Solo sportId
    if (sportId !== null) {
      return this.canAccessSport(userId, sportId);
    }
    // Sin ningún recurso específico → denegar por defecto
    return false;
  }

}