import { sliderProfile as p } from '@labpics/ui-tokens';
const rem = (value: number) => `${value / 16}rem`;
const large = p.large;

const accessibilityCss = `
.lab-slider-control { isolation:isolate; }
.lab-slider-control > .lab-slider-thumb { z-index:1; }
.lab-slider-control > .lab-slider-thumb:focus-within { z-index:2; }
@media (forced-colors: active) {
 [data-lab-slider] { --_slider-active:Highlight; --_slider-track:GrayText; }
 .lab-slider-thumb-visual { forced-color-adjust:none; background:Canvas; border-color:Highlight; }
 .lab-slider-circle,.lab-slider-track,.lab-slider-range { forced-color-adjust:none; }
 [data-variant='large'] .lab-slider-control { background:Canvas; outline:1px solid GrayText; }
 .lab-slider-large-fill,.lab-slider-large-mask { forced-color-adjust:none; background:Highlight; }
 .lab-slider-large-label { color:CanvasText; }
 .lab-slider-large-fill .lab-slider-large-label,[data-variant='large'] .lab-slider-thumb-visual { color:HighlightText; background-color:transparent; }
 [data-variant='large'] .lab-slider-thumb-visual { background:HighlightText; }
 [data-variant='large'][data-empty] .lab-slider-thumb-visual { background:Highlight; }
}
`;

/** The same authored paint is used by Lit and React. Range inputs remain native. */
export const sliderCss = `
[data-lab-slider] { --_slider-active:var(--lab-${p.activeRole}); --_slider-track:var(--lab-${p.trackRole}); --_slider-start:0%; --_slider-end:50%; display:flex; flex-direction:column; gap:0.5rem; min-inline-size:0; color:var(--lab-label-primary); font-family:var(--lab-font-family); }
.lab-slider-label-row { display:flex; justify-content:space-between; align-items:baseline; gap:0.75rem; font-size:0.875rem; line-height:1.25rem; }
.lab-slider-label { color:var(--lab-label-secondary); }
.lab-slider-value-text { font-variant-numeric:tabular-nums; }
.lab-slider-control { position:relative; block-size:${rem(p.thumb)}; user-select:none; touch-action:pan-y; cursor:pointer; }
.lab-slider-control::before { content:''; position:absolute; inset:-1rem 0; }
.lab-slider-track,.lab-slider-range { position:absolute; inset-block-start:50%; block-size:${rem(p.track)}; transform:translateY(-50%); border-radius:${rem(p.track)}; }
.lab-slider-track { inset-inline:0; background:var(--_slider-track); }
.lab-slider-range { inset-inline-start:var(--_slider-start); inset-inline-end:calc(100% - max(${rem(p.thumb)},var(--_slider-end))); background:var(--_slider-active); }
[data-lab-slider][data-range] .lab-slider-range { inset-inline-start:calc(max(${rem(p.thumb)},var(--_slider-start)) - ${rem(p.thumb / 2)}); inset-inline-end:calc(100% - max(${rem(p.thumb)},var(--_slider-end)) + ${rem(p.thumb / 2)}); }
.lab-slider-control > .lab-slider-thumb { position:absolute; inline-size:${rem(p.thumb)}; block-size:${rem(p.thumb)}; transform:translate(-50%,-50%); }
[data-lab-slider]:dir(rtl):not([data-variant='circular']):not([data-orientation='vertical']) .lab-slider-thumb { transform:translate(50%,-50%); }
.lab-slider-thumb-visual { position:absolute; inset:0; box-sizing:border-box; border-radius:50%; corner-shape:round; border:${rem(p.thumbStroke)} solid var(--_slider-active); background:var(--lab-${p.thumbRole}); pointer-events:none; }
.lab-slider-thumb:has(input:focus-visible) .lab-slider-thumb-visual { outline:2px solid var(--lab-${p.focusRole}); outline-offset:3px; }
.lab-slider-thumb input { position:absolute; inline-size:${rem(p.hitSize)}; block-size:${rem(p.hitSize)}; inset-block-start:50%; inset-inline-start:50%; transform:translate(-50%,-50%); margin:0; opacity:0; cursor:inherit; }
[data-lab-slider]:dir(rtl) .lab-slider-thumb input { transform:translate(50%,-50%); }
.lab-slider-helper,.lab-slider-error { font-size:0.75rem; line-height:1rem; color:var(--lab-label-tertiary); }
.lab-slider-error { color:var(--lab-label-danger); }
[data-lab-slider][data-invalid] { --_slider-active:var(--lab-label-danger); }
[data-lab-slider][data-disabled] .lab-slider-control { opacity:${p.disabledOpacity}; cursor:not-allowed; }
[data-lab-slider][data-readonly] .lab-slider-control { cursor:default; }
[data-lab-slider][data-dragging] .lab-slider-control { cursor:grabbing; }
.lab-slider-hidden { position:absolute; inline-size:1px; block-size:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
[data-variant='circular'] { inline-size:max-content; }
[data-variant='circular'] .lab-slider-control { inline-size:${rem(p.circular.diameter)}; block-size:${rem(p.circular.diameter)}; touch-action:none; }
.lab-slider-circle { display:block; inline-size:100%; block-size:100%; overflow:visible; fill:none; stroke-width:${p.circular.stroke}; pointer-events:none; }
.lab-slider-circle circle { stroke:var(--_slider-track); }
.lab-slider-circle path { stroke:var(--_slider-active); }
[data-variant='large'] .lab-slider-control { min-block-size:${rem(large.height)}; block-size:max(${rem(large.height)},calc(${rem(large.lineHeight)} + 2rem)); border-radius:${rem(large.radius)}; overflow:hidden; background:var(--lab-${large.trackRole}); touch-action:pan-y; }
[data-variant='large'] .lab-slider-control::before { inset:0; }
.lab-slider-large-fill,.lab-slider-large-mask { background:linear-gradient(to bottom,color-mix(in srgb,var(--lab-${large.highlightRole}) ${large.highlightOpacity * 100}%,transparent),transparent),var(--lab-${large.activeRole}); }
.lab-slider-large-fill { position:absolute; inset:0; clip-path:inset(0 calc(100% - var(--_slider-end)) 0 0); }
[data-lab-slider]:dir(rtl) .lab-slider-large-fill { clip-path:inset(0 0 0 calc(100% - var(--_slider-end))); }
.lab-slider-large-label { position:absolute; inset:0; display:flex; align-items:center; padding-inline:${rem(large.labelInset)}; white-space:nowrap; overflow:hidden; color:var(--lab-${large.labelRole}); font-size:${rem(large.fontSize)}; line-height:${rem(large.lineHeight)}; font-weight:${large.fontWeight}; letter-spacing:${large.letterSpacing}px; font-synthesis:none; pointer-events:none; }
.lab-slider-large-label span { overflow:hidden; text-overflow:ellipsis; }
.lab-slider-large-fill .lab-slider-large-label { color:var(--lab-${large.activeLabelRole}); }
[data-variant='large'] .lab-slider-thumb { top:50%; inline-size:${rem(large.indicatorWidth)}; block-size:${rem(large.indicatorHeight)}; }
[data-variant='large'] .lab-slider-thumb-visual { border:0; border-radius:9999px; background:var(--lab-${large.activeLabelRole}); }
[data-variant='large'][data-lab-slider][data-empty] .lab-slider-thumb-visual { background:var(--_slider-active); }
.lab-slider-large-mask { position:absolute; inline-size:${rem(large.maskWidth)}; block-size:${rem(large.height)}; left:50%; top:50%; transform:translate(-50%,-50%); filter:blur(${rem(large.maskBlur / 2)}); pointer-events:none; }
[data-lab-slider][data-empty] .lab-slider-large-mask { display:none; }
[data-orientation='vertical'] .lab-slider-control { inline-size:${rem(p.thumb)}; block-size:12rem; touch-action:pan-x; }
[data-orientation='vertical'] .lab-slider-track { inset-block:0; inset-inline:auto; left:50%; inline-size:${rem(p.track)}; block-size:auto; transform:translateX(-50%); }
[data-orientation='vertical'] .lab-slider-range { inset-block-start:calc(100% - max(${rem(p.thumb)},var(--_slider-end))); inset-block-end:var(--_slider-start); inset-inline:auto; left:50%; inline-size:${rem(p.track)}; block-size:auto; transform:translateX(-50%); }
[data-orientation='vertical'][data-range] .lab-slider-range { inset-block-start:calc(100% - max(${rem(p.thumb)},var(--_slider-end)) + ${rem(p.thumb / 2)}); inset-block-end:calc(max(${rem(p.thumb)},var(--_slider-start)) - ${rem(p.thumb / 2)}); }
[data-orientation='vertical'] .lab-slider-thumb { top:auto; transform:translate(-50%,50%); }
${accessibilityCss}
`;
