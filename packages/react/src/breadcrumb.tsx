'use client';

import {
  type LabBreadcrumbItem,
  type LabBreadcrumbSize,
  breadcrumbIndices,
  breadcrumbKeys,
  breadcrumbLimit,
  breadcrumbSize,
} from '@labpics/ui-core/breadcrumb/contract';
import {
  type HTMLAttributes,
  type ReactNode,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';
import '@labpics/ui-core/breadcrumb.css';

export interface BreadcrumbProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  items: ReadonlyArray<LabBreadcrumbItem>;
  size?: LabBreadcrumbSize;
  separator?: ReactNode;
  /** Maximum visible positions, including the disclosure. Zero shows the full trail. */
  maxItems?: number;
  label?: string;
  expandLabel?: string;
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(function Breadcrumb(
  {
    items,
    size = 'm',
    separator,
    maxItems,
    label = 'Навигационная цепочка',
    expandLabel = 'Показать все разделы',
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) {
  const [expanded, setExpanded] = useState(false);
  const pendingFocus = useRef(false);
  const nav = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!expanded || !pendingFocus.current) return;
    pendingFocus.current = false;
    nav.current
      ?.querySelector<HTMLElement>('[data-breadcrumb-index="1"] .lab-breadcrumb-link')
      ?.focus();
  }, [expanded]);
  const indices = breadcrumbIndices(items.length, breadcrumbLimit(maxItems), expanded);
  const keys = breadcrumbKeys(items);
  return (
    <nav
      {...rest}
      ref={(element) => {
        nav.current = element;
        if (typeof ref === 'function') ref(element);
        else if (ref) ref.current = element;
      }}
      aria-label={ariaLabel ?? label}
      data-lab-breadcrumb=""
      data-size={breadcrumbSize(size)}
    >
      <ol className="lab-breadcrumb-list">
        {indices.map((index, position) => {
          const current = index === items.length - 1;
          const item = items[index];
          return (
            <li
              key={index === -1 ? 'disclosure' : keys[index]}
              className="lab-breadcrumb-item"
              data-breadcrumb-index={index}
            >
              {index === -1 ? (
                <button
                  className="lab-breadcrumb-expand"
                  type="button"
                  aria-label={expandLabel}
                  onClick={() => {
                    pendingFocus.current = true;
                    setExpanded(true);
                  }}
                >
                  <span className="lab-breadcrumb-ellipsis" aria-hidden="true" />
                </button>
              ) : current ? (
                <span className="lab-breadcrumb-current" aria-current="page">
                  {item?.label}
                </span>
              ) : item?.href != null ? (
                <a className="lab-breadcrumb-link" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <span className="lab-breadcrumb-link" tabIndex={-1}>
                  {item?.label}
                </span>
              )}
              {position < indices.length - 1 && (
                <span className="lab-breadcrumb-separator" aria-hidden="true">
                  {separator ?? <span className="lab-breadcrumb-chevron" />}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
