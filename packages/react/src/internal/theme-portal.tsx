'use client';

import { bindPortalScope } from '@labpics/ui-core/theme';
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const useClientLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

/** React владеет mount/SSR портала; правило скоупа принадлежит core theme. */
export function ThemePortal({
  source,
  children,
}: {
  source: RefObject<Element>;
  children: ReactNode;
}): ReactNode {
  const [mounted, setMounted] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useClientLayoutEffect(() => {
    const anchor = source.current;
    const target = host.current;
    if (!anchor || !target) return;
    return bindPortalScope(anchor, target);
  }, [mounted, source]);

  const body = mounted ? source.current?.ownerDocument.body : undefined;
  return body
    ? createPortal(
        <div ref={host} data-lab-portal-scope="" style={{ display: 'contents' }}>
          {children}
        </div>,
        body,
      )
    : null;
}
