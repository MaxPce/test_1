import {
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateAttemptDto {
  @IsNumber()
  participationId: number;

  @IsNumber()
  @Min(1)
  attemptNumber: number;

  @IsOptional()
  @IsString()
  attemptType?: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsBoolean()
  isValid?: boolean;
}
