import { IsNumber, IsOptional, IsEnum, IsInt } from 'class-validator';

export class CreateEventCategoryDto {
  @IsOptional()
  @IsInt()
  eventId?: number; 

  @IsInt()
  categoryId: number;

  @IsOptional()
  @IsInt()
  externalEventId?: number; 

  @IsOptional()
  @IsInt()
  externalSportId?: number;

  @IsOptional()
  @IsEnum(['pendiente', 'en_curso', 'finalizado'])
  status?: string;
}
