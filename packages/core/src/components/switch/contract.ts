/** Meaning, independent of rendering technology. */
export type LabSwitchType = 'accent' | 'neutral' | 'danger';
export type LabSwitchSize = 's' | 'm' | 'l';

export function switchAppearance(type: LabSwitchType, checked: boolean): LabSwitchType {
  return type === 'accent' && !checked ? 'neutral' : type;
}
