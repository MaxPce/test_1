// src/taekwondo-kyorugui-medal-table/dto/medal-summary-response.dto.ts

export interface TaekwondoKyoruguiMedalRow {
  rank: number;
  institutionId: number;
  institutionName: string;
  institutionLogoUrl: string | null;
  gold: number;
  silver: number;
  bronze: number;
}

export interface TaekwondoKyoruguiMedalSummaryResponse {
  general: TaekwondoKyoruguiMedalRow[];
}