import { breadcrumbProfile as p } from '@labpics/ui-tokens';

const rem = (px: number) => `${px / 16}rem`;
const glyph = (name: keyof typeof p.glyphs) => {
  const g = p.glyphs[name];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.viewBox} ${g.viewBox}"><path transform="translate(${g.x} ${g.y})" d="${g.data}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const sizes = Object.entries(p.sizes)
  .map(
    ([size, m]) => `[data-lab-breadcrumb][data-size="${size}"] {
  --_breadcrumb-gap: ${rem(m.gap)}; --_breadcrumb-icon: ${rem(m.icon)};
  --_breadcrumb-trim: ${rem((m.multilineLineHeight - m.lineHeight) / 2)};
  font-size: ${rem(m.fontSize)}; line-height: ${m.multilineLineHeight / m.fontSize};
}`,
  )
  .join('\n');

const forcedColorsCss = `
@media (forced-colors: active) {
  [data-lab-breadcrumb] .lab-breadcrumb-link { color: CanvasText; }
  [data-lab-breadcrumb] a.lab-breadcrumb-link { color: LinkText; }
  [data-lab-breadcrumb] .lab-breadcrumb-current { color: CanvasText; }
  [data-lab-breadcrumb] :is(.lab-breadcrumb-expand, .lab-breadcrumb-separator) { color: ButtonText; }
  [data-lab-breadcrumb] :is(.lab-breadcrumb-chevron, .lab-breadcrumb-ellipsis) { forced-color-adjust: none; }
  [data-lab-breadcrumb] :is(a, button):focus-visible { outline-color: Highlight; }
}
`;

export const breadcrumbCss = `
[data-lab-breadcrumb] { display: block; min-inline-size: 0; font-family: var(--lab-font-family); font-weight: ${p.fontWeight}; letter-spacing: ${p.letterSpacing}em; }
${sizes}
[data-lab-breadcrumb] .lab-breadcrumb-list { display: flex; flex-wrap: wrap; align-items: center; gap: var(--_breadcrumb-gap); margin: 0; padding: 0; list-style: none; }
[data-lab-breadcrumb] .lab-breadcrumb-item { display: inline-flex; align-items: center; min-inline-size: 0; max-inline-size: 100%; gap: var(--_breadcrumb-gap); }
[data-lab-breadcrumb] :is(.lab-breadcrumb-link, .lab-breadcrumb-current) { min-inline-size: 0; overflow-wrap: anywhere; margin-block: calc(0px - var(--_breadcrumb-trim)); }
[data-lab-breadcrumb] .lab-breadcrumb-link { color: var(--lab-${p.roles.label}); text-decoration: none; }
[data-lab-breadcrumb] .lab-breadcrumb-current { color: var(--lab-${p.roles.current}); }
[data-lab-breadcrumb] a:hover { color: var(--lab-${p.roles.hover}); text-decoration: underline; }
[data-lab-breadcrumb] :is(a, button):focus-visible { outline: var(--lab-focus-ring-width) solid var(--lab-${p.roles.focus}); outline-offset: var(--lab-focus-ring-offset); border-radius: var(--lab-radius-xs); }
[data-lab-breadcrumb] .lab-breadcrumb-separator { display: inline-flex; align-items: center; justify-content: center; flex: none; inline-size: var(--_breadcrumb-icon); block-size: var(--_breadcrumb-icon); color: var(--lab-${p.roles.label}); user-select: none; }
[data-lab-breadcrumb] .lab-breadcrumb-chevron { display: block; inline-size: 100%; block-size: 100%; background: currentColor; mask: ${glyph('chevron')} center / contain no-repeat; }
[data-lab-breadcrumb]:dir(rtl) .lab-breadcrumb-chevron { transform: scaleX(-1); }
[data-lab-breadcrumb] .lab-breadcrumb-expand { display: inline-flex; align-items: center; justify-content: center; flex: none; inline-size: var(--_breadcrumb-icon); block-size: var(--_breadcrumb-icon); padding: 0; border: 0; background: transparent; color: var(--lab-${p.roles.label}); cursor: pointer; }
[data-lab-breadcrumb] .lab-breadcrumb-expand:hover { color: var(--lab-${p.roles.hover}); }
[data-lab-breadcrumb] .lab-breadcrumb-ellipsis { display: block; inline-size: 100%; block-size: 100%; background: currentColor; mask: ${glyph('ellipsis')} center / contain no-repeat; }
${forcedColorsCss}
`;
