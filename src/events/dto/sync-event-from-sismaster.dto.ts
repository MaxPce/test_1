import { IsInt, IsOptional } from 'class-validator';

export class SyncEventFromSismasterDto {
  @IsInt()
  externalEventId: number; // idevent sismaster

  @IsInt()
  externalSportId: number; // idsport sismaster

  @IsInt()
  @IsOptional()
  categoryId?: number; // categoryId de TU base de datos (formatosdb)
}
