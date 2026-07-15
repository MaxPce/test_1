// src/weightlifting-medal-table/dto/medal-detail-response.dto.ts

export interface WeightliftingMedalDetailRow {
  registrationId: number;
  athleteName: string;
  weightClass: string | null;
  phaseName: string;
  bestSnatch: number | null;
  bestCleanAndJerk: number | null;
  total: number | null;
  medalType: 'gold' | 'silver' | 'bronze';
}

export interface WeightliftingMedalDetailResponse {
  institutionId: number;
  institutionName: string;
  athletes: WeightliftingMedalDetailRow[];
}