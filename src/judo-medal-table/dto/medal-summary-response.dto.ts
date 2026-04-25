// src/judo-medal-table/dto/medal-summary-response.dto.ts

export interface JudoMedalRow {
  rank: number;
  institutionId: number;
  institutionName: string;
  institutionLogoUrl: string | null; 
  gold: number;
  silver: number;
  bronze: number;
  fifth: number;
  seventh: number;
}


export interface JudoMedalSummaryResponse {
  general: JudoMedalRow[];
}