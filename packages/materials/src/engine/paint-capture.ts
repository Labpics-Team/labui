import type { EngineHandle } from './mount';

/** A decorative capture normally sits outside layout. A scroll-host needs a
 * sticky capture inside an absolute runway spanning its scrollable area. The
 * browser follows both scroll axes; there is deliberately no scroll listener.
 * Only hosts configured to scroll observe content/viewport geometry.
 */
export function placePaintCapture(surface: HTMLElement, capture: HTMLElement): EngineHandle {
  let runway: HTMLElement | undefined;
  let observing = false;
  let disposed = false;
  let frame = 0;
  const owned = new WeakSet<Node>([capture]);
  const observed = new Set<Element>();
  const isOwned = (node: Node): boolean => {
    for (let at: Node | null = node; at && at !== surface; at = at.parentNode)
      if (owned.has(at)) return true;
    return false;
  };
  const set = (node: HTMLElement, key: string, value: string): void => {
    if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value);
  };
  const restore = (): void => {
    if (!runway) return;
    surface.prepend(capture);
    runway.remove();
    runway = undefined;
    capture.style.removeProperty('width');
    capture.style.removeProperty('height');
    capture.style.removeProperty('top');
    capture.style.removeProperty('left');
    capture.style.removeProperty('margin-right');
    capture.style.removeProperty('margin-bottom');
  };
  const measure = (): void => {
    frame = 0;
    if (disposed || !observing || !surface.isConnected) return;
    // Otherwise an old runway would keep scrollHeight/Width large after content
    // shrinks. This synchronous measurement never paints the zero-sized state.
    if (runway) {
      set(runway, 'width', '0px');
      set(runway, 'height', '0px');
    }
    const width = surface.clientWidth;
    const height = surface.clientHeight;
    const extentWidth = surface.scrollWidth;
    const extentHeight = surface.scrollHeight;
    if (extentWidth <= width && extentHeight <= height) {
      restore();
      return;
    }
    if (!runway) {
      runway = surface.ownerDocument.createElement('div');
      runway.className = 'lab-material__paint-runway';
      runway.setAttribute('aria-hidden', 'true');
      owned.add(runway);
      surface.prepend(runway);
      runway.append(capture);
    }
    const style = getComputedStyle(surface);
    const right = Number.parseFloat(style.paddingRight);
    const bottom = Number.parseFloat(style.paddingBottom);
    // Scroll overflow includes trailing padding in flex/grid. The runway must
    // not add it again, while the capture's negative trailing margins let its
    // painted box cover that padding at the final scroll position.
    set(runway, 'width', `${extentWidth - right}px`);
    set(runway, 'height', `${extentHeight - bottom}px`);
    set(capture, 'width', `${width}px`);
    set(capture, 'height', `${height}px`);
    // Sticky insets are measured from the scrollport's padding edge, whereas
    // the decoration covers its complete padding box, just like a background.
    set(capture, 'top', `${-Number.parseFloat(style.paddingTop)}px`);
    set(capture, 'left', `${-Number.parseFloat(style.paddingLeft)}px`);
    set(capture, 'margin-right', `${-right}px`);
    set(capture, 'margin-bottom', `${-bottom}px`);
  };
  const schedule = (): void => {
    if (!disposed && observing && !frame) frame = requestAnimationFrame(measure);
  };
  const resize = new ResizeObserver(schedule);
  const observeChildren = (): void => {
    const children = new Set([surface, ...Array.from(surface.children).filter((n) => !isOwned(n))]);
    for (const node of observed) {
      if (children.has(node)) continue;
      resize.unobserve(node);
      observed.delete(node);
    }
    for (const node of children) {
      if (observed.has(node)) continue;
      observed.add(node);
      resize.observe(node);
    }
  };
  const content = new MutationObserver((records) => {
    const changed = records.some((record) => {
      if (isOwned(record.target)) return false;
      // The material runtime already refreshes surface styles and ignores its
      // motion-only properties. Do not turn those into layout work again.
      if (record.type === 'attributes' && record.target === surface) return false;
      if (record.type === 'childList')
        return [...record.addedNodes, ...record.removedNodes].some((node) => !isOwned(node));
      return true;
    });
    if (!changed) return;
    observeChildren();
    schedule();
  });
  const stop = (): void => {
    observing = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    resize.disconnect();
    observed.clear();
    content.disconnect();
    surface.removeEventListener('load', schedule, true);
    surface.ownerDocument.fonts?.removeEventListener('loadingdone', schedule);
  };
  const refresh = (): void => {
    if (disposed) return;
    const style = getComputedStyle(surface);
    const scrollable = [style.overflowX, style.overflowY].some((value) =>
      ['auto', 'scroll', 'hidden'].includes(value),
    );
    if (!scrollable) {
      stop();
      restore();
      return;
    }
    if (!observing) {
      observing = true;
      observeChildren();
      content.observe(surface, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'open', 'width', 'height', 'src'],
      });
      surface.addEventListener('load', schedule, true);
      surface.ownerDocument.fonts?.addEventListener('loadingdone', schedule);
    }
    schedule();
  };
  surface.prepend(capture);
  refresh();
  return {
    refresh,
    destroy(): void {
      if (disposed) return;
      disposed = true;
      stop();
      (runway ?? capture).remove();
      runway = undefined;
    },
  };
}
