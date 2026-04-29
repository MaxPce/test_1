export interface SwimmingMedalRow {
  rank: number;
  institutionId: number;
  institutionName: string;
  institutionLogoUrl: string | null;
  gold: number;
  silver: number;
  bronze: number;
  totalPoints: number;
}

export interface SwimmingMedalSummaryResponse {
  general: SwimmingMedalRow[];
}