export interface EventSismasterDto {
  idevent: number;
  name: string;
  periodo: number;
  place: string;
  startdate: Date;
  enddate: Date;
  logo?: string;
  slug?: string;
  tipo?: string;
  level?: number;
  modality?: string;
  mstatus: number;
}
