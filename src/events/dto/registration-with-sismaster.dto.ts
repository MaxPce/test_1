export class AthleteInfoDto {
  idperson: number;
  firstname: string;
  lastname: string;
  surname?: string;
  fullName: string;
  docnumber: string;
  gender: string;
  birthday?: Date;
  country?: string;
}

export class InstitutionInfoDto {
  idinstitution: number;
  business: string;
  businessName: string;
  abrev: string;
  avatar?: string;
  country?: string;
}

export class RegistrationWithSismasterDto {
  registrationId: number;
  eventCategoryId: number;
  externalAthleteId?: number | null;
  externalInstitutionId?: number | null;
  seedNumber?: number | null; 

  // sismaster
  athlete?: AthleteInfoDto;
  institution?: InstitutionInfoDto;
  categoryName?: string;
  eventName?: string;
}
