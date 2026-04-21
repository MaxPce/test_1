// src/score-tables/dto/accumulate-score.dto.ts
import { PhaseGender, PhaseLevel } from '../../common/enums'; // ← AÑADIR

export class AccumulateScoreDto {
  externalEventId: number; 
  institutionId: number;
  externalInstitutionId?: number | null; 
  institutionName: string;
  gender: PhaseGender | null;
  level: PhaseLevel | null;
  rankPosition: number;
  isRelayOrCombined: boolean;
}