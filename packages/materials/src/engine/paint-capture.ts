import type { EngineHandle } from './mount';

/** Scroll overflow follows the inline/block progression, with a flex main or
 * cross axis reversed by its corresponding layout property. Resolve the two
 * physical signs once; placement below does not branch on layout names. */
function scrollAxes(style: CSSStyleDeclaration): { x: number; y: number } {
  const vertical = style.writingMode !== 'horizontal-tb';
  const inline =
    (style.direction === 'rtl' ? -1 : 1) * (style.writingMode === 'sideways-lr' ? -1 : 1);
  const block = style.writingMode.endsWith('-rl') ? -1 : 1;
  const axes = vertical ? { x: block, y: inline } : { x: inline, y: block };
  if (style.display.includes('flex')) {
    const mainX = style.flexDirection.startsWith('row') !== vertical;
    if (style.flexDirection.endsWith('reverse')) axes[mainX ? 'x' : 'y'] *= -1;
    if (style.flexWrap === 'wrap-reverse') axes[mainX ? 'y' : 'x'] *= -1;
  }
  return axes;
}

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
    for (const name of ['width', 'height', 'inset', 'margin']) capture.style.removeProperty(name);
  };
  const measure = (): void => {
    frame = 0;
    if (disposed || !observing || !surface.isConnected) return;
    // Exclude the whole decorative subtree. A zero-size runway still lets its
    // sticky child affect Gecko's trailing padding and old extent after shrink.
    // The excluded state is synchronous and never painted.
    if (runway) set(runway, 'display', 'none');
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
    const top = Number.parseFloat(style.paddingTop);
    const right = Number.parseFloat(style.paddingRight);
    const bottom = Number.parseFloat(style.paddingBottom);
    const left = Number.parseFloat(style.paddingLeft);
    const axes = scrollAxes(style);
    set(
      runway,
      'inset',
      `${axes.y > 0 ? '0' : 'auto'} ${axes.x < 0 ? '0' : 'auto'} ${axes.y < 0 ? '0' : 'auto'} ${axes.x > 0 ? '0' : 'auto'}`,
    );
    set(runway, 'justify-items', axes.x > 0 ? 'start' : 'end');
    set(runway, 'align-items', axes.y > 0 ? 'start' : 'end');
    set(runway, 'width', `${extentWidth}px`);
    set(runway, 'height', `${extentHeight}px`);
    set(capture, 'width', `${width}px`);
    set(capture, 'height', `${height}px`);
    // Sticky insets are measured from the scrollport's padding edge, whereas
    // the decoration covers its complete padding box, just like a background.
    set(capture, 'inset', `${-top}px ${-right}px ${-bottom}px ${-left}px`);
    set(capture, 'margin', `${-top}px ${-right}px ${-bottom}px ${-left}px`);
    runway.style.removeProperty('display');
    // Layout containment keeps sticky overflow out of the parent calculation.
    // Browsers differ in whether an absolute child adds trailing grid/flex
    // padding. Measure that contribution once instead of encoding engine rules.
    const extraWidth = Math.max(0, surface.scrollWidth - extentWidth);
    const extraHeight = Math.max(0, surface.scrollHeight - extentHeight);
    if (extraWidth) set(runway, 'width', `${extentWidth - extraWidth}px`);
    if (extraHeight) set(runway, 'height', `${extentHeight - extraHeight}px`);
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
