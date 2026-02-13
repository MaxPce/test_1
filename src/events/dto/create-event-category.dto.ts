import { IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateEventCategoryDto {
  @IsNumber()
  eventId: number;

  @IsNumber()
  categoryId: number;

  @IsOptional()
  @IsNumber()
  externalEventId?: number; 

  @IsOptional()
  @IsNumber()
  externalSportId?: number; 


  @IsOptional()
  @IsEnum(['pendiente', 'en_curso', 'finalizado'])
  status?: string;
}
