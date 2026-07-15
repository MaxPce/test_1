// src/taekwondo-kyorugui-medal-table/dto/medal-detail-response.dto.ts

export interface TaekwondoMedalDetailRow {
  registrationId: number;
  athleteName: string;
  categoryName: string;
  phaseName: string;
  position: number;
  medalType: 'gold' | 'silver' | 'bronze';
}

export interface TaekwondoMedalDetailResponse {
  institutionId: number;
  institutionName: string;
  athletes: TaekwondoMedalDetailRow[];
}