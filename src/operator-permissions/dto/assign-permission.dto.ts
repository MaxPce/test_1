import { IsInt, IsOptional, IsEnum } from 'class-validator';

export class AssignPermissionDto {
  @IsInt()
  userId: number;

  @IsOptional()
  @IsInt()
  sportId?: number;

  @IsOptional()
  @IsInt()
  eventId?: number;

  @IsOptional()
  @IsEnum(['local', 'sismaster'])
  eventSource?: 'local' | 'sismaster';
}