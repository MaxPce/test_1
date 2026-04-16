import { IsInt, IsPositive } from 'class-validator';

export class MoveEntrySectionDto {
  @IsInt()
  @IsPositive()
  athleticsSectionId: number;
}