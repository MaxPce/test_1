// src/karate-medal-table/dto/medal-detail-response.dto.ts

export interface KarateMedalDetailRow {
  registrationId: number;
  athleteName: string;
  categoryName: string;
  phaseName: string;
  position: number;
  medalType: 'gold' | 'silver' | 'bronze';
}

export interface KarateMedalDetailResponse {
  institutionId: number;
  institutionName: string;
  athletes: KarateMedalDetailRow[];
}