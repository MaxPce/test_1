import { IsNumber, IsString, IsOptional, MaxLength } from 'class-validator';

export class AddTeamMemberDto {
  @IsNumber()
  athleteId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  rol?: string;
}
