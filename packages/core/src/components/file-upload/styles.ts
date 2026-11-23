import { fileUploadProfile as p } from '@labpics/ui-tokens';
import { fileUploadArtwork } from './artwork.generated.js';

const rem = (n: number) => `${n / 16}rem`;
const color = (role: string) => `var(--lab-${role})`;

export const fileUploadCss = `
[data-lab-file-upload] { display:flex; flex-direction:column; min-inline-size:0; gap:${rem(p.fieldGap)}; font-family:var(--lab-font-family); color:${color(p.roles.label)}; }
${Object.entries(p.sizes)
  .map(
    ([size, m]) =>
      `[data-lab-file-upload][data-size="${size}"] { --_upload-height:${rem(m.height)}; --_upload-radius:${rem(m.radius)}; --_upload-px:${rem(m.paddingX)}; --_upload-py:${rem(m.paddingY)}; --_upload-font:${rem(m.fontSize)}; --_upload-line:${m.lineHeight / m.fontSize}; --_upload-weight:${m.fontWeight}; --_upload-tracking:${m.letterSpacing / m.fontSize}em; }`,
  )
  .join('\n')}
.lab-upload-surface { position:relative; isolation:isolate; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; min-inline-size:0; border:${rem(p.strokeWidth)} solid ${color(p.roles.border)}; border-radius:var(--_upload-radius); background:transparent; color:inherit; }
.lab-upload-trigger { appearance:none; border:0; background:none; color:inherit; cursor:pointer; font:inherit; letter-spacing:inherit; }
.lab-upload-input-row { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; min-inline-size:0; gap:${rem(p.gap)}; min-block-size:calc(var(--_upload-height) - ${rem(p.strokeWidth * 2)}); box-sizing:border-box; padding:calc(var(--_upload-py) - ${rem(p.strokeWidth)}) var(--_upload-px); inline-size:100%; font-size:var(--_upload-font); line-height:var(--_upload-line); font-weight:var(--_upload-weight); letter-spacing:var(--_upload-tracking); }
.lab-upload-input-row.lab-upload-trigger { border-radius:inherit; }
.lab-upload-empty { color:${color(p.roles.secondary)}; }
[data-lab-file-upload] .lab-upload-surface:has(.lab-upload-trigger:hover:not(:disabled)), [data-lab-file-upload][data-view="input"] .lab-upload-surface:hover:not([data-disabled]):not(:has(input:disabled)):not([data-readonly]) { background-color:${color(p.roles.hover)}; }
[data-lab-file-upload][data-view="dropzone"] .lab-upload-surface { min-block-size:${rem(p.area.height)}; padding:calc(${rem(p.area.paddingY)} - ${rem(p.strokeWidth)}) clamp(${rem(16)}, 8vw, ${rem(p.area.paddingX)}); gap:${rem(p.area.gap)}; border-radius:${rem(p.area.radius)}; background:${color(p.roles.background)}; }
.lab-upload-artwork { display:block; position:relative; flex:none; inline-size:${rem(p.area.illustrationWidth)}; block-size:${rem(p.area.illustrationHeight)}; max-inline-size:100%; pointer-events:none; }
.lab-upload-artwork::before { content:''; position:absolute; inset:0 0 auto; block-size:${rem(p.area.artwork.default.height)}; background:url('${fileUploadArtwork.default}') top center/100% auto no-repeat; }
.lab-upload-surface:hover:not([data-disabled]):not(:has(input:disabled)):not([data-readonly]):not([data-selected]) .lab-upload-artwork::before { inset-block-start:${rem(p.area.artwork.hover.offsetY)}; block-size:${rem(p.area.artwork.hover.height)}; background-image:url('${fileUploadArtwork.hover}'); }
.lab-upload-surface[data-selected] .lab-upload-artwork::before { block-size:${rem(p.area.artwork.selected.height)}; background-image:url('${fileUploadArtwork.selected}'); }
.lab-upload-surface[data-dragging] .lab-upload-artwork { inline-size:${rem(p.area.dragIllustrationWidth)}; block-size:${rem(p.area.dragIllustrationHeight)}; }
.lab-upload-surface[data-dragging] .lab-upload-artwork::before { inset-block-start:0 !important; block-size:${rem(p.area.artwork.drag.height)}; background-image:url('${fileUploadArtwork.drag}') !important; }
.lab-upload-title { margin:0; font-size:${rem(p.area.title.fontSize)}; line-height:${p.area.title.lineHeight / p.area.title.fontSize}; font-weight:${p.area.title.fontWeight}; letter-spacing:${p.area.title.letterSpacing / p.area.title.fontSize}em; text-align:center; font-feature-settings:'ss01' 1; overflow-wrap:anywhere; max-inline-size:100%; }
.lab-upload-or, .lab-upload-label, .lab-upload-helper, .lab-upload-error, .lab-upload-remove { font-size:${rem(p.caption.fontSize)}; line-height:${p.caption.lineHeight / p.caption.fontSize}; font-weight:${p.caption.fontWeight}; letter-spacing:${p.caption.letterSpacing / p.caption.fontSize}em; }
.lab-upload-or, .lab-upload-helper { color:${color(p.roles.secondary)}; }
.lab-upload-browse { position:relative; }
.lab-upload-files { list-style:none; margin:0; padding:0; inline-size:100%; display:flex; flex-direction:column; align-items:center; gap:${rem(p.gap)}; }
.lab-upload-file { display:flex; align-items:center; justify-content:center; gap:${rem(p.gap)}; max-inline-size:100%; min-inline-size:0; }
.lab-upload-name { overflow-wrap:anywhere; min-inline-size:0; }
.lab-upload-file-icon { inline-size:${rem(24)}; block-size:${rem(24)}; flex:none; color:${color(p.roles.secondary)}; background:currentColor; mask:url('${fileUploadArtwork.file}') center/contain no-repeat; }
.lab-upload-remove { appearance:none; border:0; background:none; color:${color(p.roles.secondary)}; padding:${rem(8)}; border-radius:${rem(8)}; flex:none; cursor:pointer; }
[data-lab-file-upload][data-view="input"] .lab-upload-files { gap:0; }
[data-lab-file-upload][data-view="input"] .lab-upload-file { inline-size:100%; }
[data-lab-file-upload][data-view="dropzone"] .lab-upload-file { flex-wrap:wrap; }
.lab-upload-surface[data-dragging] { border:${rem(p.dragStrokeWidth)} dashed ${color(p.roles.dragBorder)}; background:${color(p.roles.dragBackground)} !important; }
[data-lab-file-upload][data-view="dropzone"] .lab-upload-surface[data-dragging]::before { content:''; position:absolute; inset:0; z-index:-1; border-radius:inherit; background:url('${fileUploadArtwork['drag-background']}') center/cover no-repeat; }
.lab-upload-surface[data-dragging] .lab-upload-or, .lab-upload-surface[data-dragging] .lab-upload-browse { display:none; }
.lab-upload-surface:is([data-disabled], :has(input:disabled)) { color:${color(p.roles.disabled)}; }
.lab-upload-surface:is([data-disabled], :has(input:disabled)) .lab-upload-empty, .lab-upload-surface:is([data-disabled], :has(input:disabled)) .lab-upload-or, .lab-upload-remove:disabled { color:${color(p.roles.disabled)}; cursor:default; }
.lab-upload-surface:is([data-disabled], :has(input:disabled)):not([data-selected]) .lab-upload-artwork { display:none; }
.lab-upload-trigger:disabled { cursor:default; }
.lab-upload-trigger:focus-visible, .lab-upload-remove:focus-visible { outline:var(--lab-focus-ring-width) solid ${color(p.roles.focus)}; outline-offset:var(--lab-focus-ring-offset); }
.lab-upload-surface[data-invalid] { border-color:var(--lab-border-danger); }
.lab-upload-error { color:${color(p.roles.danger)}; }
.lab-upload-error:empty { display:none; }
.lab-upload-name.lab-upload-trigger { padding:0; }
.lab-upload-files:has(> :only-child) .lab-upload-remove { position:absolute; inset-inline-end:${rem(8)}; inset-block-start:${rem(8)}; }
.lab-upload-files:has(> :only-child) > .lab-upload-file { inline-size:100%; }
[data-lab-file-upload][data-view="input"] .lab-upload-files:has(> :only-child) .lab-upload-name { max-inline-size:calc(100% - ${rem(96)}); }
.lab-upload-hidden { position:absolute; inline-size:1px; block-size:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
@media (forced-colors:active) { .lab-upload-surface { border-color:ButtonText; } .lab-upload-surface[data-dragging] { border-color:Highlight; } .lab-upload-surface:is([data-disabled], :has(input:disabled)) { color:GrayText; } .lab-upload-artwork { forced-color-adjust:none; } }
`;
