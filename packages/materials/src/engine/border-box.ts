/** Local CSS geometry, before transforms and before bitmap rounding. */
export interface BorderBox {
  readonly width: number;
  readonly height: number;
  readonly border: readonly [number, number, number, number];
}

export function readBorderBox(el: HTMLElement, css: CSSStyleDeclaration): BorderBox {
  const px = (value: string): number => Number.parseFloat(value) || 0;
  const border = [
    px(css.borderTopWidth),
    px(css.borderRightWidth),
    px(css.borderBottomWidth),
    px(css.borderLeftWidth),
  ] as const;
  const used = (value: string, fallback: number, extra: number): number => {
    const size = Number.parseFloat(value);
    if (!Number.isFinite(size)) return fallback;
    if (css.boxSizing === 'border-box') return size;
    const withoutScrollbar = size + extra;
    // CSSOM's content width excludes a classic scrollbar or reserved gutter.
    // offsetWidth/Height include it, but round the entire box. Subtract the
    // rounded unscrolled box so ordinary fractional CSS sizes stay fractional.
    return withoutScrollbar + Math.max(0, fallback - Math.round(withoutScrollbar));
  };
  return {
    width: used(
      css.width,
      el.offsetWidth,
      px(css.paddingLeft) + px(css.paddingRight) + border[1] + border[3],
    ),
    height: used(
      css.height,
      el.offsetHeight,
      px(css.paddingTop) + px(css.paddingBottom) + border[0] + border[2],
    ),
    border,
  };
}
