/**
 * <Card> — React-реализация анатомии `<lab-card>` без Lit runtime (ADR-0001).
 * Elevated отдаёт нижний Content владельцу @labpics/ui-materials; media остаётся
 * снаружи. Outlined и filled сохраняют прежние заливки без живых материалов,
 * пока их соответствие Figma не установлено. Типы вариантов общие с Core.
 * Article, header и footer сохраняют нативную семантику; действия принадлежат
 * вложенным контролам. После SSR эффект подключает материал и освобождает его
 * при смене варианта или unmount, включая повторный mount в Strict Mode.
 */
'use client';

import type { LabCardPadding, LabCardVariant } from '@labpics/ui-core';
import { mountMaterialRuntime } from '@labpics/ui-materials';
import {
  type HTMLAttributes,
  type ReactNode,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import '@labpics/ui-materials/material.css';
import './card.css';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Surface treatment. */
  variant?: LabCardVariant;
  /** Inner spacing of the body region. */
  padding?: LabCardPadding;
  /** Hover + focus affordance for whole-card interactive targets. */
  interactive?: boolean;
  /** Edge-to-edge media region (parity with the Lit `media` slot). */
  media?: ReactNode;
  /** Header region (parity with the Lit `header` slot). */
  header?: ReactNode;
  /** Footer region (parity with the Lit `footer` slot). */
  footer?: ReactNode;
  /** Body content (parity with the Lit default slot). */
  children?: ReactNode;
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    variant = 'elevated',
    padding = 'm',
    interactive = false,
    media,
    header,
    footer,
    children,
    ...rest
  },
  ref,
) {
  const contentRef = useRef<HTMLDivElement>(null);
  useClientLayoutEffect(() => {
    if (variant !== 'elevated' || !contentRef.current) return;
    return mountMaterialRuntime(contentRef.current);
  }, [variant]);

  return (
    <article
      {...rest}
      ref={ref}
      data-lab-card=""
      data-variant={variant}
      data-padding={padding}
      data-interactive={interactive || undefined}
    >
      {media != null ? <div className="lab-card-media">{media}</div> : null}
      <div
        ref={contentRef}
        className={
          variant === 'elevated'
            ? 'lab-card-content lab-material lab-material--elevated'
            : 'lab-card-content'
        }
      >
        {header != null ? <header className="lab-card-header">{header}</header> : null}
        <div className="lab-card-body">{children}</div>
        {footer != null ? <footer className="lab-card-footer">{footer}</footer> : null}
      </div>
    </article>
  );
});
