import { AthleteSismasterDto } from './athlete-sismaster.dto';

export class AthleteByCategoryDto extends AthleteSismasterDto {
  division_inscrita: string;
  idparam: number;
  gender_text: string;
}
