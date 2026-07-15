// src/tennis-medal-table/dto/medal-summary-response.dto.ts

export interface TennisMedalRow {
  rank: number;
  institutionId: number;
  institutionName: string;
  institutionLogoUrl: string | null;
  gold: number;
  silver: number;
  bronze: number;
}

export interface TennisMedalSummaryResponse {
  general: TennisMedalRow[];
}