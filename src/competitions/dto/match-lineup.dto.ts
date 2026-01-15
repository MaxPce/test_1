import {
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LineupItemDto {
  @IsNumber()
  athleteId: number;

  @IsNumber()
  @Min(1)
  @Max(4)
  lineupOrder: number; // 1=A, 2=B, 3=C, 4=Suplente

  @IsBoolean()
  isSubstitute: boolean;
}

export class SetMatchLineupDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineupItemDto)
  lineups: LineupItemDto[];
}
