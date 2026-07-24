export interface PodiumEntry {
  rank: number;             // 1, 2 o 3
  athleteName: string;      // "Apellido, Nombre" o nombre de posta
  institutionName: string;
  institutionAbbrev: string | null;
  institutionLogoUrl: string | null;
  finalTime: string | null;
  notes: string | null;
  isTied: boolean;
}

export interface PhasePodium {
  eventCategoryId: number;
  eventNumber: number;
  eventName: string;         // "Girls 200 LC Meter Freestyle"
  categoryName: string;      // "Avanzados" | "Noveles"
  gender: string;            // "Damas" | "Varones"
  isRelay: boolean;
  podium: PodiumEntry[];     // máx. 3 posiciones (puede haber empates → más de 3 entradas)
}

export interface SwimmingPhasePodiumResponse {
  phases: PhasePodium[];
}