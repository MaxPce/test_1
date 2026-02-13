import { IsInt, IsArray, ArrayMinSize } from 'class-validator';

export class AssignCategoryDto {
  @IsInt()
  sismasterEventId: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  categoryIds: number[];
}

export class RemoveCategoryDto {
  @IsInt()
  sismasterEventId: number;

  @IsInt()
  categoryId: number;
}
