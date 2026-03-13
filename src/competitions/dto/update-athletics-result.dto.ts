import { PartialType } from '@nestjs/mapped-types';
import { CreateAthleticsResultDto } from './create-athletics-result.dto';

export class UpdateAthleticsResultDto extends PartialType(CreateAthleticsResultDto) {}
