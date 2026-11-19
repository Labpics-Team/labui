'use client';

import {
  type LabAvatarColor,
  type LabAvatarFallback,
  type LabAvatarSize,
  type LabAvatarStatus,
  avatarColor,
  avatarDefaults,
  avatarInitials,
  avatarName,
  avatarStatus,
  observeAvatarImage,
} from '@labpics/ui-core/avatar/contract';
import { type HTMLAttributes, forwardRef, useEffect, useRef, useState } from 'react';
import '@labpics/ui-core/avatar.css';

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  size?: LabAvatarSize;
  color?: LabAvatarColor;
  status?: LabAvatarStatus;
  src?: string;
  name?: string;
  initials?: string;
  fallback?: LabAvatarFallback;
  decorative?: boolean;
  statusLabel?: string;
}

/** A keyed subtree cancels observation of old requests, including A → B → A races. */
const AvatarImage = ({ src, report }: { src: string; report: (ready: boolean) => void }) => {
  const image = useRef<HTMLImageElement>(null);
  useEffect(
    () => (image.current ? observeAvatarImage(image.current, report) : undefined),
    [report],
  );
  return <img ref={image} className="lab-avatar-image" src={src} alt="" decoding="async" />;
};
const AvatarContent = ({ src, initials }: { src?: string; initials: string }) => {
  const [ready, setReady] = useState(false);
  return (
    <span className="lab-avatar-disc" data-ready={ready ? '' : undefined} aria-hidden="true">
      {initials ? (
        <span className="lab-avatar-initials">{initials}</span>
      ) : (
        <span className="lab-avatar-texture" />
      )}
      {src ? <AvatarImage src={src} report={setReady} /> : null}
    </span>
  );
};
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  {
    size = 'm',
    color = avatarDefaults.color,
    status: requestedStatus = 'none',
    src: requestedSrc,
    name = '',
    initials,
    fallback = avatarDefaults.fallback,
    decorative = false,
    statusLabel = '',
    ...rest
  },
  ref,
) {
  const status = avatarStatus(requestedStatus);
  const src = requestedSrc?.trim();
  return (
    <span
      {...rest}
      ref={ref}
      data-lab-avatar=""
      data-size={size}
      data-color={avatarColor(color)}
      data-status={status}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : avatarName(name, status, statusLabel)}
      aria-hidden={decorative || undefined}
    >
      <AvatarContent
        key={src ?? ''}
        src={src}
        initials={fallback === 'texture' ? '' : avatarInitials(name, initials)}
      />
      {status !== 'none' ? <span className="lab-avatar-status" aria-hidden="true" /> : null}
    </span>
  );
});
