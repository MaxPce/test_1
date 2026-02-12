export class AthleteSismasterDto {
  idperson: number;
  docnumber: string;
  firstname: string;
  lastname: string;
  surname: string;
  fullName: string;
  gender: string;
  birthday: Date;
  age?: number | null; 
  country: string;
  
  // institución
  idinstitution: number;
  institutionName: string;
  institutionAbrev: string;
  institutionLogo?: string;
  
  // acreditación
  idacreditation: number;
  idevent: number;
  idsport: number;
  photo?: string;
}
