export type LabChipSize = 's' | 'm';
export type LabChipMode = 'filter' | 'action' | 'remove';

/** Selection is a value; active is an independent authored brand emphasis. */
export function chipSelected(mode: LabChipMode, selected: boolean): boolean {
  return mode === 'remove' || selected;
}
