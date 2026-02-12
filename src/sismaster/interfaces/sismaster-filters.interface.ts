export interface AccreditationFilters {
  idevent: number;
  idsport: number;
  idinstitution?: number;
  tregister?: 'D' | 'E' | 'O'; 
  gender?: 'M' | 'F';
}
