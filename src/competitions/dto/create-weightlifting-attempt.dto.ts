import { IsEnum, IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class UpsertWeightliftingAttemptDto {
  @IsEnum(['snatch', 'clean_and_jerk'])
  liftType: 'snatch' | 'clean_and_jerk';

  @IsIn([1, 2, 3])
  attemptNumber: 1 | 2 | 3;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number | null;

  @IsEnum(['valid', 'invalid', 'not_attempted'])
  result: 'valid' | 'invalid' | 'not_attempted';
}
