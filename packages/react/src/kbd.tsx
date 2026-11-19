'use client';

import { type LabKbdSize, kbdSize } from '@labpics/ui-core/kbd/contract';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import '@labpics/ui-core/kbd.css';

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** Small (16) or large (24). Legacy m is an alias for l. */
  size?: LabKbdSize;
  /** Ordered key labels. An empty list falls back to children. */
  keys?: readonly string[];
  /** One key, when keys is empty or omitted. */
  children?: ReactNode;
}

export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd(
  { size = 's', keys = [], children, className, ...rest },
  ref,
) {
  const chord = keys.length > 0;
  return (
    <kbd
      {...rest}
      ref={ref}
      data-lab-kbd=""
      data-size={kbdSize(size)}
      className={[!chord && 'lab-kbd-key', className].filter(Boolean).join(' ')}
    >
      {chord
        ? keys.map((key, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: A cap has no state; its identity is its position in the shortcut.
            <kbd className="lab-kbd-key" key={index}>
              {key}
            </kbd>
          ))
        : children}
    </kbd>
  );
});
