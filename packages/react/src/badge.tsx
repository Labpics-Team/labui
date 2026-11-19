'use client';

import {
  type LabBadgeColor,
  type LabBadgeType,
  badgeColor,
  badgeDefaultColor,
} from '@labpics/ui-core/badge/contract';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import '@labpics/ui-core/badge.css';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  color?: LabBadgeColor;
  type?: LabBadgeType;
  disabled?: boolean;
  /** Decorative leading sign, painted and sized by Badge. */
  icon?: ReactNode;
  /** Decorative trailing sign. */
  iconEnd?: ReactNode;
  /** Legacy dot content; use icon for an author sign. */
  dot?: ReactNode;
  children?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    color = badgeDefaultColor,
    type = 'fill',
    disabled = false,
    icon,
    iconEnd,
    dot,
    children,
    ...rest
  },
  ref,
) {
  return (
    <span
      {...rest}
      ref={ref}
      data-lab-badge=""
      data-color={badgeColor(color)}
      data-type={type}
      data-disabled={disabled || undefined}
    >
      {icon != null && (
        <span className="lab-badge-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {dot != null && (
        <span className="lab-badge-dot" aria-hidden="true">
          <span>{dot}</span>
        </span>
      )}
      <span className="lab-badge-label">{children}</span>
      {iconEnd != null && (
        <span className="lab-badge-icon" aria-hidden="true">
          {iconEnd}
        </span>
      )}
    </span>
  );
});
