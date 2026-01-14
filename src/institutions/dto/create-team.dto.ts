import { IsString, IsNumber, MaxLength, IsOptional } from 'class-validator';

export class CreateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsNumber()
  institutionId: number;

  @IsNumber()
  categoryId: number;
}
