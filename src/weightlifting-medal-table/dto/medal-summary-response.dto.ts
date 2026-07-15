// src/weightlifting-medal-table/dto/medal-summary-response.dto.ts

export interface WeightliftingMedalRow {
  rank: number;
  institutionId: number;
  institutionName: string;
  institutionLogoUrl: string | null;
  gold: number;
  silver: number;
  bronze: number;
}

export interface WeightliftingMedalSummaryResponse {
  general: WeightliftingMedalRow[];
}