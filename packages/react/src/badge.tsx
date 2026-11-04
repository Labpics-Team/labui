/** Нативная React-анатомия Badge; типы и семантические роли общие с Core. */
'use client';

import type { LabBadgeColor, LabBadgeType } from '@labpics/ui-core';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import './badge.css';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  /** Семейство семантического цвета. */
  color?: LabBadgeColor;
  /** Непрозрачная или полупрозрачная поверхность. */
  type?: LabBadgeType;
  /** Приглушённое неинтерактивное состояние. */
  disabled?: boolean;
  /** Декоративная иконка перед текстом; заменяет dot. */
  leading?: ReactNode;
  /** Декоративная иконка после текста. */
  trailing?: ReactNode;
  /** Прежний индикатор, когда leading не передан. */
  dot?: ReactNode;
  /** Текст метки. */
  children?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { color = 'neutral', type = 'fill', disabled = false, leading, trailing, dot, children, ...rest },
  ref,
) {
  return (
    <span
      {...rest}
      ref={ref}
      data-lab-badge=""
      data-color={color}
      data-type={type}
      data-disabled={disabled || undefined}
    >
      {leading != null ? (
        <span className="lab-badge-icon" aria-hidden="true">
          {leading}
        </span>
      ) : dot != null ? (
        <span className="lab-badge-dot" aria-hidden="true">
          {dot}
        </span>
      ) : null}
      {children}
      {trailing != null ? (
        <span className="lab-badge-icon" aria-hidden="true">
          {trailing}
        </span>
      ) : null}
    </span>
  );
});
