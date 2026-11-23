import { colorPickerProfile as p } from '@labpics/ui-tokens';
const rem = (value: number) => `${value / 16}rem`;
export const colorPickerCss = `
[data-lab-color-picker] { margin:0; border:0; min-inline-size:0; position:relative; isolation:isolate; box-sizing:border-box; display:flex; flex-direction:column; gap:${rem(p.gap)}; padding:${rem(p.padding)}; inline-size:${rem(p.width)}; max-inline-size:100%; border-radius:${rem(p.radius)}; color:var(--lab-label-primary); font-family:var(--lab-font-family); font-size:1rem; line-height:1.5rem; letter-spacing:-.25px; font-synthesis:none; }
[data-lab-color-picker] *,[data-lab-color-picker] *::before,[data-lab-color-picker] *::after { box-sizing:border-box; }
[data-lab-color-picker] > :not([class*="lab-material__"]) { position:relative; }
.lab-color-header { display:flex; align-items:center; justify-content:space-between; block-size:${rem(p.headerHeight)}; }
.lab-color-heading { flex:1; text-align:center; font-weight:500; letter-spacing:0; }
.lab-color-action { border:0; padding:0; background:transparent; display:inline-flex; align-items:center; justify-content:center; color:var(--lab-label-secondary); inline-size:1.5rem; block-size:1.5rem; cursor:pointer; flex:none; }
.lab-color-action svg { inline-size:100%; block-size:100%; }
.lab-color-action[data-action=eyedropper] { color:var(--lab-label-accent); }
[data-lab-color-picker] :is(button,input,select):focus-visible { outline:2px solid var(--lab-border-focus); outline-offset:3px; }
.lab-color-view { min-inline-size:0; }
.lab-color-lch-spectrum { display:flex; flex-direction:column; gap:.75rem; aspect-ratio:1; }
.lab-color-lch-spectrum .lab-color-marker { inline-size:2rem; block-size:2rem; border-width:4px; }
.lab-color-plane { margin:0; padding:0; min-inline-size:0; position:relative; inline-size:100%; aspect-ratio:1; border-radius:${rem(p.areaRadius)}; border:1px solid var(--lab-border-base); touch-action:none; user-select:none; }
.lab-color-plane[data-plane=spectrum] { background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),var(--_color-hue); }
.lab-color-plane[data-plane]:not([data-plane=spectrum]) { aspect-ratio:auto; block-size:${rem(p.channel.graphHeight)}; margin-block:0 ${rem(p.channel.graphGap)}; background:transparent; overflow:visible; }
.lab-color-lch-spectrum .lab-color-plane[data-plane] { margin:0; flex:1; block-size:auto; }
.lab-color-plane canvas { position:absolute; inset:0; inline-size:100%; block-size:100%; border-radius:inherit; }
.lab-color-marker { position:absolute; left:clamp(.5rem,var(--_color-x),calc(100% - .5rem)); bottom:clamp(.5rem,var(--_color-y),calc(100% - .5rem)); inline-size:1rem; block-size:1rem; transform:translate(-50%,50%); border:2px solid white; border-radius:50%; background:var(--_color-selected); box-shadow:0 0 0 1px #0001; pointer-events:none; }
[data-plane=spectrum] .lab-color-marker { inline-size:2rem; block-size:2rem; border-width:4px; left:clamp(.875rem,var(--_color-x),calc(100% - .875rem)); bottom:clamp(.875rem,var(--_color-y),calc(100% - .875rem)); }
.lab-color-plane:focus-within .lab-color-marker { outline:2px solid var(--lab-border-focus); outline-offset:2px; }
.lab-color-hidden { position:absolute!important; inline-size:1px!important; block-size:1px!important; padding:0!important; margin:0!important; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.lab-color-grid { display:grid; grid-template-columns:repeat(var(--_color-columns),1fr); grid-template-rows:repeat(${p.grid.rows},1fr); block-size:${rem(p.grid.height)}; border:1px solid var(--lab-border-base); border-radius:${rem(p.areaRadius)}; overflow:hidden; }
[data-model=lch] .lab-color-grid { block-size:auto; aspect-ratio:1; }
.lab-color-swatch { appearance:none; padding:0; border:0; min-inline-size:0; min-block-size:0; cursor:pointer; position:relative; }
.lab-color-swatch[aria-checked=true]::after { content:''; position:absolute; inset:2px; border:2px solid white; box-shadow:0 0 0 1px #0005; border-radius:3px; }
.lab-color-swatch:focus-visible { z-index:2; outline-offset:-3px!important; }
.lab-color-channels { display:flex; flex-direction:column; gap:${rem(p.gap)}; }
[data-variant=sliders] .lab-color-channels { padding-block-start:${rem(p.channel.sliderPaddingY)}; }
[data-variant=sliders] .lab-color-footer { margin-block-end:${rem(p.channel.sliderPaddingY)}; }
[data-variant=sliders] .lab-color-channel:nth-child(2) .lab-color-channel-label,[data-variant=sliders] .lab-color-channel:nth-child(3) .lab-color-channel-label { margin-block-end:${rem(p.channel.middleLabelGap)}; }
[data-variant=sliders][data-model=lch] .lab-color-channel:not(:last-child) .lab-color-channel-label { margin-block-end:${rem(p.channel.graphLabelGap)}; }
[data-variant=grid] .lab-color-channel-label { margin-block-end:${rem(p.channel.middleLabelGap)}; }
.lab-color-channel { display:grid; grid-template-columns:minmax(0,1fr) ${rem(p.channel.fieldWidth)}; column-gap:${rem(p.channel.gap)}; align-items:end; }
.lab-color-channel-label { display:block; color:var(--lab-label-secondary); font-size:.875rem; line-height:${rem(p.channel.labelHeight)}; letter-spacing:0; margin-block-end:${rem(p.channel.labelGap)}; }
.lab-color-channel-track { position:relative; block-size:${rem(p.channel.trackHeight)}; border-radius:999px; background:repeating-conic-gradient(#00000006 0 25%,transparent 0 50%) 0 / .5rem .5rem; }
.lab-color-channel-paint { position:absolute; inset:0; border-radius:inherit; background:var(--_color-gradient); border:1px solid #0000000a; }
.lab-color-channel-thumb { position:absolute; left:calc(${rem(p.channel.thumb / 2 + 2)} + (100% - ${rem(p.channel.thumb + 4)})*var(--_color-fraction)); top:50%; transform:translate(-50%,-50%); inline-size:${rem(p.channel.thumb)}; block-size:${rem(p.channel.thumb)}; border:${rem(p.channel.thumbStroke)} solid white; border-radius:50%; background:var(--_color-selected); pointer-events:none; }
.lab-color-channel-track:focus-within .lab-color-channel-thumb { outline:2px solid var(--lab-border-focus); outline-offset:2px; }
.lab-color-range { position:absolute; inset:0; margin:0; inline-size:100%; block-size:100%; opacity:0; cursor:pointer; }
.lab-color-number { appearance:none; inline-size:100%; min-inline-size:0; block-size:${rem(p.channel.trackHeight)}; padding:0 .5rem; border:0; border-radius:.5rem; background:var(--lab-fill-quaternary); color:inherit; font:inherit; font-weight:500; letter-spacing:0; text-align:center; font-variant-numeric:tabular-nums; }
.lab-color-separator { inline-size:100%; block-size:0; border:0; box-shadow:0 0 0 .5px var(--lab-border-base); margin:0; }
.lab-color-footer { display:flex; align-items:center; gap:${rem(p.footer.gap)}; min-inline-size:0; block-size:${rem(p.footer.height)}; }
.lab-color-model { position:relative; flex:0 0 ${rem(p.footer.modelWidth)}; display:flex; align-items:center; block-size:2rem; border:1px solid var(--lab-border-base); border-radius:999px; padding:0 .625rem; gap:.5rem; font-size:.875rem; line-height:1.25rem; letter-spacing:0; }
.lab-color-model svg,.lab-color-model lab-icon,.lab-color-model [data-lab-icon] { inline-size:1rem; block-size:1rem; flex:none; }
.lab-color-model select { appearance:none; position:absolute; inset:0; inline-size:100%; opacity:0; cursor:pointer; }
.lab-color-model-label { flex:1; }
.lab-color-text-field { flex:1; display:flex; align-items:center; gap:.5rem; padding:0 .75rem; block-size:${rem(p.footer.height)}; min-inline-size:0; border:1px solid var(--lab-border-base); border-radius:${rem(p.footer.radius)}; }
.lab-color-text-field input { appearance:none; min-inline-size:0; inline-size:0; flex:1; border:0; padding:0; color:inherit; background:transparent; font:inherit; letter-spacing:-.25px; }
.lab-color-text-field .lab-color-action { inline-size:1.25rem; block-size:1.25rem; }
.lab-color-dot { inline-size:1rem; block-size:1rem; border-radius:50%; background:var(--_color-selected); flex:none; }
.lab-color-coordinates { display:flex; gap:.25rem; min-inline-size:0; flex:1; block-size:100%; }
.lab-color-coordinate { appearance:none; inline-size:0; flex:1; padding:0 .375rem; border:1px solid var(--lab-border-base); border-radius:${rem(p.footer.radius)}; font:inherit; color:inherit; background:transparent; text-align:center; font-variant-numeric:tabular-nums; }
.lab-color-options { display:flex; flex-direction:column; gap:1rem; }
[data-lab-color-picker][data-disabled] :is(.lab-color-view,.lab-color-channels,.lab-color-footer) { opacity:.45; }
[data-lab-color-picker] :disabled { cursor:default; }
[data-lab-color-picker][data-readonly] :is(.lab-color-range,.lab-color-swatch) { cursor:default; }
@media (forced-colors:active) { .lab-color-marker,.lab-color-channel-thumb { forced-color-adjust:none; } .lab-color-plane,.lab-color-channel-paint,.lab-color-swatch,.lab-color-dot { forced-color-adjust:none; } .lab-color-number,.lab-color-text-field,.lab-color-coordinate { border:1px solid CanvasText; } }
`;
