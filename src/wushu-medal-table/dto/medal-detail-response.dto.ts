// src/wushu-medal-table/dto/medal-detail-response.dto.ts

export interface WushuMedalDetailRow {
  registrationId: number;
  athleteName: string;
  categoryName: string;
  phaseName: string;
  position: number;
  medalType: 'gold' | 'silver' | 'bronze';
}

export interface WushuMedalDetailResponse {
  institutionId: number;
  institutionName: string;
  athletes: WushuMedalDetailRow[];
}