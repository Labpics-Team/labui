'use client';

import { type ReactNode, useLayoutEffect, useRef } from 'react';
import '../dialog.css';

/** Клиентская top-layer плоскость; модальность и фокус принадлежат Core Dialog. */
export function DialogPortalPlane({
  open,
  children,
}: { open: boolean; children: ReactNode }): ReactNode {
  const portalPlane = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const plane = portalPlane.current;
    if (!plane) return;
    plane.popover = 'manual';
    if (!open) return;
    plane.showPopover();
    return () => {
      if (plane.matches(':popover-open')) plane.hidePopover();
    };
  }, [open]);
  return (
    <div ref={portalPlane} className="lab-dialog-portal-plane">
      {children}
    </div>
  );
}
