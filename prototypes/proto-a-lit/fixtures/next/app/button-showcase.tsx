'use client';

// Client leaf: the typed @lit/react wrapper needs the browser (refs/effects),
// so the 'use client' boundary stays here — not at the page root (dive-next P1).
import { Button } from '@labpics/proto-a-lit/react';

/**
 * Criterion 2 (type-safety) is exercised at compile time HERE: `type` and
 * `kind` are typed unions from the wrapper — a wrong literal is a TS error, not
 * an any-hole. Criterion 1 (SSR) is exercised by the fact this renders deep
 * declarative shadow DOM in the server response.
 */
export function ButtonShowcase() {
  return (
    <>
      <Button type="accent" kind="fill" data-testid="next-accent-fill">
        Accent fill
      </Button>
      <Button type="danger" kind="border" data-testid="next-danger-border">
        Danger border
      </Button>
      <Button type="neutral" kind="ghost" data-testid="next-neutral-ghost">
        Neutral ghost
      </Button>
    </>
  );
}
