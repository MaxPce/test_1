import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

export class ManualRankItemDto {
  @IsInt()
  registrationId: number;  

  @IsOptional()
  @IsInt()
  @Min(1)
  manualRankPosition: number | null;
}

export class SetManualRanksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualRankItemDto)
  ranks: ManualRankItemDto[];
}
