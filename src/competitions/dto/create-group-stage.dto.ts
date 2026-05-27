import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

export class GroupDefinitionDto {
  @IsString()
  label: string; // "A", "B", "C"

  @IsArray()
  @ArrayMinSize(2)
  @IsNumber({}, { each: true })
  registrationIds: number[]; // ← el nombre exacto que envía el frontend
}

export class CreateGroupStageDto {
  @IsNumber()
  parentPhaseId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupDefinitionDto)
  groups: GroupDefinitionDto[];

  @IsNumber()
  @Min(1)
  qualifiersPerGroup: number;
}