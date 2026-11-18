import { loaderProfile as loader, progressProfile as profile } from '@labpics/ui-tokens';
import { progressUnknownGeometry as unknown } from './contract.js';
const rem = (px: number) => `${px / 16}rem`;
const sectorMaskCss =
  '.lab-loader-sector { mask:conic-gradient(#000 calc(var(--_progress-ratio)*1turn),transparent 0); }';

/** Shared authored paint for Lit and native React. */
export const progressCss = `
.lab-progress-root { --_progress-ratio:var(--_progress-target,0); --_progress-radius:${rem(profile.radius)}; --_thickness:${rem(profile.sizes.m.thickness)}; --_diameter:${rem(profile.sizes.m.circularDiameter)}; color:var(--lab-${profile.activeRole}); display:flex; flex-direction:column; gap:var(--lab-space-2); min-inline-size:0; max-inline-size:100%; }
${Object.entries(profile.sizes)
  .map(
    ([size, m]) =>
      `.lab-progress-root[data-size='${size}']{--_thickness:${rem(m.thickness)};--_diameter:${rem(m.circularDiameter)};}`,
  )
  .join('\n')}
.lab-progress-meta { display:flex; align-items:baseline; justify-content:space-between; gap:var(--lab-space-2); min-inline-size:0; }
.lab-progress-label,.lab-progress-value-text { font-family:var(--lab-font-family); font-size:${rem(profile.circular.fontSize)}; line-height:${rem(profile.circular.lineHeight)}; font-weight:${profile.circular.fontWeight}; letter-spacing:0; color:var(--lab-${profile.circular.labelRole}); overflow-wrap:anywhere; }
.lab-progress-value-text { flex:none; }
.lab-progress-track { position:relative; block-size:var(--_thickness); inline-size:100%; overflow:hidden; border-radius:var(--_progress-radius); corner-shape:round; background:var(--lab-${profile.trackRole}); }
.lab-progress-range { position:absolute; inset:0; background:currentColor; border-radius:inherit; corner-shape:round; transform:scaleX(var(--_progress-ratio)); transform-origin:left; }
.lab-progress-track:dir(rtl) .lab-progress-range { transform-origin:right; }
.lab-progress-track[data-state='indeterminate'] .lab-progress-range { inline-size:${unknown.widthPercent}%; transform:translateX(calc(var(--_progress-travel,${unknown.travelRest})*1%)); }
.lab-progress-root[data-variant='circular'] { display:inline-flex; align-items:center; }
.lab-progress-circle { position:relative; inline-size:var(--_diameter); block-size:var(--_diameter); max-inline-size:100%; flex:none; }
.lab-progress-circle svg { inline-size:100%; block-size:100%; display:block; overflow:visible; }
.lab-progress-circle .lab-progress-value-text { position:absolute; inset:0; display:grid; place-items:center; }
.lab-progress-circle .lab-progress-value-text > span { text-box:trim-both cap alphabetic; }
.lab-progress-arc { stroke-linecap:${profile.circular.cap}; stroke-dasharray:var(--_progress-ratio) 1; }
.lab-progress-circle[data-zero] .lab-progress-arc { visibility:hidden; }
.lab-progress-circle[data-state='indeterminate'] .lab-progress-arc { stroke-dasharray:${profile.unknown.fraction} 1; }
.lab-progress-circle .lab-progress-spin, .lab-loader .lab-progress-spin { transform-origin:center; }
.lab-loader { --_progress-ratio:var(--_progress-target,0); --_diameter:${rem(loader.sizes.m.diameter)}; display:inline-flex; vertical-align:middle; inline-size:var(--_diameter); block-size:var(--_diameter); position:relative; flex:none; color:var(--lab-${loader.colorRole}); }
${Object.entries(loader.sizes)
  .map(([size, m]) => `.lab-loader[data-size='${size}']{--_diameter:${rem(m.diameter)};}`)
  .join('\n')}
.lab-loader svg { display:block; inline-size:100%; block-size:100%; }
.lab-loader-sector { position:absolute; inset:${((loader.viewBox / 2 - loader.determinate.medium.sectorRadius) / loader.viewBox) * 100}%; border-radius:var(--lab-radius-circle); corner-shape:round; background:conic-gradient(from ${loader.determinate.medium.gradient.fromDegrees}deg,var(--lab-${loader.determinate.medium.secondaryRole}) 0%,currentColor ${loader.determinate.medium.gradient.primaryStop * 100}%,var(--lab-${loader.determinate.medium.secondaryRole}) ${loader.determinate.medium.gradient.secondaryStop * 100}%); }
${sectorMaskCss}
.lab-loader .lab-progress-arc { stroke-linecap:${loader.determinate.large.cap}; }
.lab-loader[data-size='l'] .lab-loader-sector { display:none; }
.lab-loader:not([data-size='l']) .lab-loader-large { display:none; }
.lab-loader[data-size='l'] .lab-loader-medium { display:none; }
`;
