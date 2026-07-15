// src/karate-medal-table/dto/medal-summary-response.dto.ts

export interface KarateMedalRow {
  rank: number;
  institutionId: number;
  institutionName: string;
  institutionLogoUrl: string | null;
  gold: number;
  silver: number;
  bronze: number;
}

export interface KarateMedalSummaryResponse {
  general: KarateMedalRow[];
}