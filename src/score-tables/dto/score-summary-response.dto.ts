// src/score-tables/dto/score-summary-response.dto.ts
export interface ScoreRow {
  rank: number;
  institutionId: number;
  institutionName: string;
  points: number;
  gold: number;
  silver: number;
  bronze: number;
}

export interface ScoreSummaryResponse {
  general: ScoreRow[];
  damas: ScoreRow[];
  varones: ScoreRow[];
  noveles: ScoreRow[];
  avanzados: ScoreRow[];
}