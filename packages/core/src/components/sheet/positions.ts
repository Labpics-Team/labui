export const sheetPositions = ['full', 'two-thirds', 'half', 'one-third', 'flex'] as const;
export type LabSheetPosition = (typeof sheetPositions)[number];

export interface SheetGeometry {
  readonly viewport: number;
  readonly tops: Readonly<Record<LabSheetPosition, number>>;
}

export function parseSheetPosition(value: unknown): LabSheetPosition {
  if (sheetPositions.some((position) => position === value)) return value as LabSheetPosition;
  throw new TypeError(`LabSheet: неизвестная позиция ${String(value)}`);
}

/** Геометрия эталона: фиксированные пресеты, Half с overlap и измеренный Flex. */
export function sheetGeometry(
  viewport: number,
  overlap: number,
  heights: Readonly<Record<'full' | 'two-thirds' | 'one-third' | 'flex', number>>,
): SheetGeometry {
  if (![viewport, overlap, ...Object.values(heights)].every(Number.isFinite)) {
    throw new TypeError('LabSheet: размеры должны быть конечными');
  }
  const extent = Math.max(0, viewport);
  const top = (height: number): number => extent - Math.min(extent, Math.max(0, height));
  return {
    viewport: extent,
    tops: {
      full: top(heights.full),
      'two-thirds': top(heights['two-thirds']),
      half: top((extent + overlap) / 2),
      'one-third': top(heights['one-third']),
      flex: top(heights.flex),
    },
  };
}

export function closestSheetPosition(
  geometry: SheetGeometry,
  top: number,
  current: LabSheetPosition,
): LabSheetPosition | 'closed' {
  // При совпавших из-за viewport clamp пресетах сохраняется текущая семантика.
  let closest: LabSheetPosition | 'closed' = current;
  let distance = Math.abs(geometry.tops[current] - top);
  for (const position of sheetPositions) {
    const nextDistance = Math.abs(geometry.tops[position] - top);
    if (nextDistance < distance) {
      closest = position;
      distance = nextDistance;
    }
  }
  if (Math.abs(geometry.viewport - top) < distance) closest = 'closed';
  return closest;
}
