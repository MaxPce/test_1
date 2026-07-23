// src/competitions/dto/set-weightlifting-manual-ranks.dto.ts
import { IsArray, ValidateNested, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class WeightliftingManualRankItemDto {
  @IsInt() registrationId: number;
  @IsOptional() @IsInt() snatchRank?: number | null;
  @IsOptional() @IsInt() cleanAndJerkRank?: number | null;
  @IsOptional() @IsInt() totalRank?: number | null;
}

export class SetWeightliftingManualRanksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeightliftingManualRankItemDto)
  ranks: WeightliftingManualRankItemDto[];
}