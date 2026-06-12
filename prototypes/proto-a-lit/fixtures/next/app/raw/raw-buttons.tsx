'use client';

import type { DetailedHTMLProps, HTMLAttributes } from 'react';
// Side-effect import registers the <lab-button> custom element.
import '@labpics/proto-a-lit';

// Minimal JSX typing for the raw custom element (no @lit/react wrapper here).
type LabButtonAttrs = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  type?: string;
  kind?: string;
};
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'lab-button': LabButtonAttrs;
    }
  }
}

export function RawButtons() {
  return (
    <>
      <lab-button type="accent" kind="fill" data-testid="raw-accent-fill">
        Accent fill
      </lab-button>
      <lab-button type="danger" kind="border" data-testid="raw-danger-border">
        Danger border
      </lab-button>
    </>
  );
}
