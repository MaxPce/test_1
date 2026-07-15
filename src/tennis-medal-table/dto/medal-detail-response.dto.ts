// src/tennis-medal-table/dto/medal-detail-response.dto.ts

export interface TennisMedalDetailRow {
  registrationId: number;
  athleteName: string;
  categoryName: string;
  phaseName: string;
  position: number;
  medalType: 'gold' | 'silver' | 'bronze';
}

export interface TennisMedalDetailResponse {
  institutionId: number;
  institutionName: string;
  athletes: TennisMedalDetailRow[];
}