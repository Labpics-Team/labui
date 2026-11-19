import { avatarProfile } from '@labpics/ui-tokens';

export const avatarDefaults = {
  color: avatarProfile.defaultColor as keyof typeof avatarProfile.colors,
  fallback: avatarProfile.defaultFallback as LabAvatarFallback,
} as const;

export type LabAvatarSize = keyof typeof avatarProfile.sizes;
export type LabAvatarColor = keyof typeof avatarProfile.colors | keyof typeof avatarProfile.aliases;
export type LabAvatarStatus = 'none' | keyof typeof avatarProfile.statuses;
export type LabAvatarFallback = 'initials' | 'texture';

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
function letters(text: string, limit: number): string {
  let result = '';
  let count = 0;
  for (const { segment } of segmenter.segment(text)) {
    result += segment;
    if (++count === limit) break;
  }
  return result;
}

/** The visible letter mark can be explicit; its name remains independent for accessibility. */
export function avatarInitials(name: string, initials?: string): string {
  if (initials !== undefined) return letters(initials.trim().toUpperCase(), 2);
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length
    ? letters(letters(words[0] ?? '', 1).toUpperCase(), 1) +
        (words.length > 1 ? letters(letters(words.at(-1) ?? '', 1).toUpperCase(), 1) : '')
    : '';
}

export function avatarColor(color: string): keyof typeof avatarProfile.colors {
  if (Object.hasOwn(avatarProfile.colors, color)) return color as keyof typeof avatarProfile.colors;
  return (
    Object.hasOwn(avatarProfile.aliases, color)
      ? avatarProfile.aliases[color as keyof typeof avatarProfile.aliases]
      : avatarProfile.defaultColor
  ) as keyof typeof avatarProfile.colors;
}

export function avatarStatus(status: string): LabAvatarStatus {
  return Object.hasOwn(avatarProfile.statuses, status) ? (status as LabAvatarStatus) : 'none';
}

export function avatarName(name: string, status: LabAvatarStatus, statusLabel = ''): string {
  const label = name.trim() || 'Аватар';
  const presence = status === 'none' ? '' : statusLabel || avatarProfile.statuses[status]?.label;
  return presence ? `${label}, ${presence}` : label;
}

/** Recheck a cached image after hydration, where its load event may precede client listeners. */
export function observeAvatarImage(
  image: HTMLImageElement,
  complete: (ready: boolean) => void,
): () => void {
  let active = true;
  let revision = 0;
  const loaded = async () => {
    const current = ++revision;
    try {
      await image.decode();
      if (active && current === revision) complete(image.naturalWidth > 0);
    } catch {
      if (active && current === revision) complete(false);
    }
  };
  const failed = () => {
    revision++;
    if (active) complete(false);
  };
  image.addEventListener('load', loaded);
  image.addEventListener('error', failed);
  if (image.complete) {
    if (image.naturalWidth > 0) void loaded();
    else failed();
  }
  return () => {
    active = false;
    revision++;
    image.removeEventListener('load', loaded);
    image.removeEventListener('error', failed);
  };
}
