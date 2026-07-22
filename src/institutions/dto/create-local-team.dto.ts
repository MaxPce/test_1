// src/institutions/dto/create-local-team.dto.ts
import { Type } from 'class-transformer';
import {
  IsString, IsNotEmpty, IsOptional, IsNumber,
  IsArray, ValidateNested, MinLength, IsIn,
} from 'class-validator';

export class LocalTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  docNumber?: string;

  @IsOptional()
  @IsString()
  @IsIn(['titular', 'suplente', 'capitan'])
  rol?: string;
}

export class CreateLocalTeamDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  teamName: string;

  @IsNumber()
  @IsNotEmpty()
  categoryId: number;

  @IsOptional()
  @IsNumber()
  institutionId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocalTeamMemberDto)
  members: LocalTeamMemberDto[];
}