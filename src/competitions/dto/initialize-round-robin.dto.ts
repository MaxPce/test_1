import { IsNumber, IsArray, IsOptional, Min } from 'class-validator';

export class InitializeRoundRobinDto {
  @IsNumber()
  phaseId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  registrationIds: number[];

  @IsOptional()       
  @IsNumber()
  @Min(2)
  emptyParticipantCount?: number;
}
