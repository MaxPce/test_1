// src/wushu-medal-table/dto/medal-summary-response.dto.ts

export interface WushuMedalRow {
  rank: number;
  institutionId: number;
  institutionName: string;
  institutionLogoUrl: string | null;
  gold: number;
  silver: number;
  bronze: number;
}

export interface WushuMedalSummaryResponse {
  general: WushuMedalRow[];
}