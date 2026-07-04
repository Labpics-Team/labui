/**
 * <Avatar> — the native-React twin of the Lit `<lab-avatar>` (ADR-0001).
 *
 * Same axes (size × color × status, src/name), same semantic --lab-* roles, same
 * honest fallback chain (image → initials → default glyph), same a11y (alt /
 * role="img"+aria-label, visually-hidden status label) — parity is CSS.
 *
 * Genuinely a Client Component (dive-next P1): it holds local view state — an
 * `onError` on the <img> flips to the initials fallback for real, so a broken URL
 * never shows a broken-image icon. That is the one honest reason for `'use
 * client'` here; the other three primitives have no such state.
 */
'use client';

import type { LabAvatarColor, LabAvatarSize, LabAvatarStatus } from '@labpics/ui-core';
import { type HTMLAttributes, forwardRef, useState } from 'react';
import './avatar.css';

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  /** Avatar size. */
  size?: LabAvatarSize;
  /** Initials background / label colour family. */
  color?: LabAvatarColor;
  /** Presence indicator. `none` hides the dot. */
  status?: LabAvatarStatus;
  /** Image URL. When present and it loads, the image wins. */
  src?: string;
  /** Used to derive initials AND as the accessible name. */
  name?: string;
}

const STATUS_LABEL: Record<Exclude<LabAvatarStatus, 'none'>, string> = {
  online: 'Online',
  offline: 'Offline',
  away: 'Away',
  dnd: 'Do not disturb',
};

/** Initials: first letters of the first and last words, uppercased. */
function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0]?.[0] ?? '';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { size = 'm', color = 'neutral', status = 'none', src, name = '', ...rest },
  ref,
) {
  // Track which src last errored, so a NEW src is a fresh attempt — the React
  // "adjust state during render when a prop changes" pattern (no effect, no
  // stale frame), mirroring the Lit element's willUpdate reset.
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const imageFailed = src !== undefined && failedSrc === src;

  const showImage = Boolean(src) && !imageFailed;
  const initials = deriveInitials(name);
  const statusLabel = status !== 'none' ? STATUS_LABEL[status] : undefined;

  return (
    <span
      {...rest}
      ref={ref}
      data-lab-avatar=""
      data-size={size}
      data-color={color}
      data-status={status}
    >
      <span
        className="lab-avatar-disc"
        role={showImage ? undefined : 'img'}
        // Without an image the disc is `role="img"` (WCAG 4.1.2 needs a real
        // name for that role): an unnamed avatar still renders the honest
        // neutral placeholder glyph, so it needs a generic fallback name
        // instead of an empty aria-label (axe `role-img-alt`).
        aria-label={showImage ? undefined : name || 'Avatar'}
      >
        {showImage ? (
          <img src={src} alt={name} onError={() => setFailedSrc(src)} />
        ) : initials ? (
          <span aria-hidden="true">{initials}</span>
        ) : (
          <svg viewBox="0 0 24 24" width="60%" height="60%" fill="currentColor" aria-hidden="true">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6Z" />
          </svg>
        )}
        {statusLabel ? <span className="lab-avatar-status" /> : null}
      </span>
      {statusLabel ? <span className="lab-avatar-sr-only">{statusLabel}</span> : null}
    </span>
  );
});
