// competitions/athletics/dto/generate-athletics-phases.dto.ts
import { IsNumber, IsPositive } from 'class-validator';

export class GenerateAthleticsPhasesDто {
  @IsNumber()
  @IsPositive()
  eventId: number;

  @IsNumber()
  @IsPositive()
  eventCategoryId: number; // la categoría madre (ej: "100 Metros")
}