import { IsInt, IsPositive } from 'class-validator';

export class RegisterEventCategoriesDto {
  @IsInt()
  @IsPositive()
  sismasterEventId: number;
}

export class RegisterEventCategoriesResponseDto {
  localEventId: null;
  sismasterEventId: number;
  sportsProcessed: number;
  created: number;
  skipped: number;  
  alreadyExists: number;
}
