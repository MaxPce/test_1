// update-weightlifting-positions.dto.ts
export class UpdatePositionEntryDto {
  participationId: number;
  snatchPosition?: number | null;
  cnjPosition?: number | null;
  totalPosition?: number | null;
}

export class UpdateWeightliftingPositionsDto {
  positions: UpdatePositionEntryDto[];
}