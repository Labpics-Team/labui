import { badgeProfile } from '@labpics/ui-tokens';

export type LabBadgeColor = keyof typeof badgeProfile.colors | keyof typeof badgeProfile.aliases;
export type LabBadgeType = 'fill' | 'tinted';
export const badgeDefaultColor = badgeProfile.defaultColor as LabBadgeColor;

/** Legacy sentiment spellings resolve at the API boundary, never in the paint. */
export function badgeColor(color: LabBadgeColor): keyof typeof badgeProfile.colors {
  return (badgeProfile.aliases[color as keyof typeof badgeProfile.aliases] ??
    color) as keyof typeof badgeProfile.colors;
}
