import { IsNumber, IsArray } from 'class-validator';

export class InitializeRoundRobinDto {
  @IsNumber()
  phaseId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  registrationIds: number[];
}
