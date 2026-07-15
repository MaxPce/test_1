// src/judo-medal-table/dto/medal-detail-response.dto.ts

export interface JudoMedalDetailRow {
  registrationId: number;
  athleteName: string;
  categoryName: string;
  phaseName: string;
  position: number;
  medalType: 'gold' | 'silver' | 'bronze' | 'fifth' | 'seventh';
}

export interface JudoMedalDetailResponse {
  institutionId: number;
  institutionName: string;
  athletes: JudoMedalDetailRow[];
}