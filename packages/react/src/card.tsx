'use client';

import type { LabCardPadding, LabCardVariant } from '@labpics/ui-core';
import { mountCardRuntime } from '@labpics/ui-core/card/runtime';
import {
  type HTMLAttributes,
  type ReactNode,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import '@labpics/ui-materials/material.css';
import '@labpics/ui-core/card.css';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: LabCardVariant;
  padding?: LabCardPadding;
  /** Highlights focus inside the card; actions remain real links and buttons. */
  interactive?: boolean;
  /** The same image is used for the media and the backdrop under the content. */
  image?: string;
  imageAlt?: string;
  heading?: string;
  headingHint?: string;
  description?: string;
  caption?: string;
  lowerCaption?: string;
  badge?: ReactNode;
  media?: ReactNode;
  /** Replaces the built-in text layout. */
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    variant = 'elevated',
    padding = 'l',
    interactive = false,
    image,
    imageAlt = '',
    heading,
    headingHint,
    description,
    caption,
    lowerCaption,
    badge,
    media,
    header,
    footer,
    children,
    ...rest
  },
  ref,
) {
  const element = useRef<HTMLElement | null>(null);
  const runtime = useRef<ReturnType<typeof mountCardRuntime>>();
  useClientLayoutEffect(() => {
    if (!element.current) return;
    runtime.current ??= mountCardRuntime(element.current);
    runtime.current.refresh();
  });
  useClientLayoutEffect(
    () => () => {
      runtime.current?.dispose();
      runtime.current = undefined;
    },
    [],
  );
  const text =
    heading || description || caption || lowerCaption ? (
      <div className="lab-card-text">
        {caption && <p className="lab-card-caption">{caption}</p>}
        {(heading || description) && (
          <div className="lab-card-title-group">
            {heading && (
              <div className="lab-card-title-row">
                <h2 className="lab-card-title">{heading}</h2>
                {headingHint && <span className="lab-card-hint">{headingHint}</span>}
                {badge}
              </div>
            )}
            {description && <p className="lab-card-description">{description}</p>}
          </div>
        )}
        {lowerCaption && <p className="lab-card-caption">{lowerCaption}</p>}
      </div>
    ) : null;
  const hasMedia = media != null || !!image;
  const headerContent = header ?? text;
  return (
    <article
      {...rest}
      ref={(node) => {
        element.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      data-lab-card=""
      data-variant={variant}
      data-padding={padding}
      data-image={image ? '' : undefined}
      data-media={hasMedia ? '' : undefined}
      data-interactive={interactive || undefined}
    >
      {image && (
        <div className="lab-card-image" aria-hidden="true">
          <img src={image} alt="" />
        </div>
      )}
      {hasMedia && (
        <div className="lab-card-media">{media ?? <img src={image} alt={imageAlt} />}</div>
      )}
      <div
        className={
          variant === 'elevated'
            ? 'lab-card-content lab-material lab-material--elevated'
            : 'lab-card-content'
        }
      >
        {headerContent != null && (
          <header className="lab-card-region lab-card-header">{headerContent}</header>
        )}
        {children != null && <div className="lab-card-region lab-card-body">{children}</div>}
        {footer != null && <footer className="lab-card-region lab-card-footer">{footer}</footer>}
      </div>
    </article>
  );
});
