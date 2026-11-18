import { avatarProfile as p } from '@labpics/ui-tokens';

const rem = (value: number) => `${value / 16}rem`;

const shapeCss = `
.lab-avatar-disc { display:grid; position:relative; inline-size:100%; block-size:100%; border-radius:calc(var(--_avatar-size)/2); corner-shape:round; overflow:hidden; isolation:isolate; user-select:none; }
[data-lab-avatar]:not([data-status='none']) .lab-avatar-disc { mask-image:radial-gradient(circle at var(--_avatar-status-x) calc(100% - var(--_avatar-dot)/2),transparent calc(var(--_avatar-dot)/2 + var(--_avatar-gap)),black 0); }
.lab-avatar-status { position:absolute; inset-inline-end:0; inset-block-end:0; inline-size:var(--_avatar-dot); block-size:var(--_avatar-dot); border-radius:calc(var(--_avatar-dot)/2); corner-shape:round; }
`;

/** Shared authored geometry; presence cuts a transparent hole instead of painting a background ring. */
export const avatarCss = `
[data-lab-avatar] { --_avatar-color:var(--lab-${p.colors[p.defaultColor as keyof typeof p.colors].role}); --_avatar-status-x:calc(100% - var(--_avatar-dot)/2); display:inline-flex; position:relative; flex:none; vertical-align:middle; inline-size:var(--_avatar-size); block-size:var(--_avatar-size); }
[data-lab-avatar]:dir(rtl) { --_avatar-status-x:calc(var(--_avatar-dot)/2); }
${Object.entries(p.sizes)
  .map(
    ([size, m]) =>
      `[data-lab-avatar][data-size='${size}'] { --_avatar-size:${rem(m.diameter)}; --_avatar-font:${rem(m.fontSize)}; --_avatar-line:${rem(m.lineHeight)}; --_avatar-dot:${rem(m.statusSize)}; --_avatar-gap:${rem(m.statusGap)}; }`,
  )
  .join('\n')}
${Object.entries(p.colors)
  .map(
    ([color, m]) =>
      `[data-lab-avatar][data-color='${color}'] { --_avatar-color:var(--lab-${m.role}); }`,
  )
  .join('\n')}
${shapeCss}
.lab-avatar-initials,.lab-avatar-texture,.lab-avatar-image { grid-area:1/1; inline-size:100%; block-size:100%; }
.lab-avatar-initials { display:grid; place-items:center; box-sizing:border-box; padding-block-end:calc(var(--_avatar-size) * ${1 - p.letterBoxHeightRatio}); color:var(--lab-${p.letterRole}); background:linear-gradient(to bottom,color-mix(in srgb,var(--lab-${p.highlightRole}) ${p.highlightAlpha * 100}%,transparent),transparent),var(--_avatar-color); font-family:'${p.fontFamily}',var(--lab-font-family); font-size:var(--_avatar-font); line-height:var(--_avatar-line); font-weight:${p.fontWeight}; letter-spacing:${p.letterSpacing}px; font-synthesis:none; }
.lab-avatar-texture { background:var(--_avatar-texture,var(--_avatar-color)); background-size:100% 100%; }
.lab-avatar-image { display:block; object-fit:cover; opacity:0; }
[data-lab-avatar][data-image='ready'] .lab-avatar-image,.lab-avatar-disc[data-ready] .lab-avatar-image { opacity:1; }
[data-lab-avatar][data-image='ready'] .lab-avatar-initials,[data-lab-avatar][data-image='ready'] .lab-avatar-texture,.lab-avatar-disc[data-ready] .lab-avatar-initials,.lab-avatar-disc[data-ready] .lab-avatar-texture { visibility:hidden; }
${Object.entries(p.statuses)
  .map(
    ([status, m]) =>
      `[data-lab-avatar][data-status='${status}'] .lab-avatar-status { background:var(--lab-${m.role}); }`,
  )
  .join('\n')}
`;
