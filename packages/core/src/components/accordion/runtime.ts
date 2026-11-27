import { type Playback, scope } from '@labpics/motion';
import { motionSemanticRuntime } from '@labpics/ui-tokens';
import { getActiveElement, getParentNode } from '@zag-js/dom-query';

function containsFocus(panel: HTMLElement): boolean {
  let node: Node | null = getActiveElement(panel.ownerDocument);
  while (node) {
    if (node === panel) return true;
    // Follow assigned slots and shadow hosts, which Node.contains cannot cross.
    const parent = getParentNode(node);
    if (parent === node) break;
    node = parent;
  }
  return false;
}

/** Disclosure state is immediate. One scalar moves its geometry and decoration. */
export function mountAccordionMotion(root: HTMLElement): { update(): void; dispose(): void } {
  const motion = scope(root);
  const view = root.ownerDocument.defaultView;
  const records = new Map<
    HTMLElement,
    {
      open: boolean;
      body: HTMLElement;
      panel: HTMLElement;
      playback?: Playback;
      revision: number;
    }
  >();
  let disposed = false;
  const observer =
    view &&
    new view.ResizeObserver((entries) => {
      for (const { target } of entries) {
        const item = target.closest<HTMLElement>('.lab-accordion-item');
        if (item?.hasAttribute('data-disclosing')) measure(item);
      }
    });

  function measure(item: HTMLElement): void {
    const record = records.get(item);
    if (record)
      item.style.setProperty(
        '--_accordion-height',
        `${record.body.getBoundingClientRect().height}px`,
      );
  }

  function update(): void {
    if (disposed) return;
    const items = new Set(root.querySelectorAll<HTMLElement>(':scope > .lab-accordion-item'));
    for (const [item, record] of records) {
      if (items.has(item)) continue;
      record.playback?.stop();
      observer?.unobserve(record.body);
      records.delete(item);
    }
    for (const item of items) {
      const panel = item.querySelector<HTMLElement>(':scope > .lab-accordion-content');
      const body = panel?.querySelector<HTMLElement>(':scope > .lab-accordion-body');
      if (!panel || !body) continue;
      const open = item.dataset.state === 'open';
      const existing = records.get(item);
      if (!existing) {
        records.set(item, { open, panel, body, revision: 0 });
        observer?.observe(body);
        continue;
      }
      if (existing.open === open) continue;
      // A controlled close returns focus only from this panel to its header.
      if (!open && containsFocus(panel))
        item.querySelector<HTMLButtonElement>('.lab-accordion-trigger')?.focus();
      if (!item.hasAttribute('data-disclosing'))
        item.style.setProperty('--_accordion-open', existing.open ? '1' : '0');
      existing.open = open;
      const revision = ++existing.revision;
      item.setAttribute('data-disclosing', '');
      measure(item);
      try {
        existing.playback = motion.animate(
          item,
          { '--_accordion-open': open ? '1' : '0' },
          {
            duration: motionSemanticRuntime.transition.durationMs,
            reducedMotion: 'user',
          },
        );
        void existing.playback.finished.then((result) => {
          if (disposed || revision !== existing.revision || result.status !== 'finished') return;
          item.removeAttribute('data-disclosing');
          item.style.removeProperty('--_accordion-open');
          item.style.removeProperty('--_accordion-height');
        }, fail);
      } catch (error) {
        fail(error);
      }
    }
  }

  function fail(error: unknown): void {
    if (disposed) return;
    dispose();
    root.dispatchEvent(
      new CustomEvent('motion-error', { detail: { error }, bubbles: true, composed: true }),
    );
  }

  function dispose(): void {
    disposed = true;
    observer?.disconnect();
    for (const [item, record] of records) {
      record.playback?.stop();
      item.removeAttribute('data-disclosing');
      item.style.removeProperty('--_accordion-open');
      item.style.removeProperty('--_accordion-height');
    }
    records.clear();
    motion.dispose();
    root.removeAttribute('data-lab-motion');
  }
  root.setAttribute('data-lab-motion', '');
  update();
  return { update, dispose };
}
