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
    return Number.isFinite(size) ? size + (css.boxSizing === 'border-box' ? 0 : extra) : fallback;
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
