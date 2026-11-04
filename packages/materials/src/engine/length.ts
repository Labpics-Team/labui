export interface LengthProbe {
  readonly element: HTMLElement;
  read(): number;
  restore(): void;
  destroy(): void;
}

// Обычная width переводит CSS length в used px в контексте поверхности.
// ResizeObserver видит rem/em и медиа-изменения даже при неизменном боксе host.
export function createLengthProbe(
  host: HTMLElement,
  property: string,
  fallback: number,
): LengthProbe {
  const document = host.ownerDocument;
  const element = document.createElement('span');
  element.className = 'lab-material__length';
  element.setAttribute('aria-hidden', 'true');
  element.style.cssText =
    'all:initial;display:block;position:absolute;left:0;top:0;height:0;padding:0;border:0;margin:0;min-width:0;max-width:none;box-sizing:content-box;font:inherit;visibility:hidden;pointer-events:none';
  element.style.width = `var(${property}, ${fallback}px)`;
  host.appendChild(element);
  return {
    element,
    read(): number {
      const view = document.defaultView;
      const raw = view?.getComputedStyle(host).getPropertyValue(property).trim() || `${fallback}px`;
      // Числовой px-вход прежнего API сохраняется; суффикс не отбрасывается.
      if (/^\+?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) {
        const value = Number(raw);
        if (Number.isFinite(value)) return value;
      }
      if (!view?.CSS.supports('filter', `blur(${raw})`)) {
        throw new RangeError(`lab-material: недопустимая длина ${property}`);
      }
      const used = view.getComputedStyle(element).width;
      const value = used.endsWith('px') ? Number(used.slice(0, -2)) : Number.NaN;
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`lab-material: не получена длина ${property} в px`);
      }
      return value;
    },
    restore(): void {
      if (element.parentNode !== host) host.appendChild(element);
    },
    destroy(): void {
      element.remove();
    },
  };
}
