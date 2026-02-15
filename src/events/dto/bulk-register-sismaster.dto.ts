import { IsInt, IsArray, ArrayNotEmpty } from 'class-validator';

export class BulkRegisterSismasterDto {
  @IsInt()
  eventCategoryId: number;

  @IsArray()
  @ArrayNotEmpty()
  external_athlete_ids: number[];
}
