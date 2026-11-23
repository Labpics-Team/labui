import { calendarProfile as p, paginationProfile } from '@labpics/ui-tokens';

const rem = (n: number) => `${n / 16}rem`;
const role = (name: string) => `var(--lab-${name})`;
const mask = (viewBox: number, path: string, x = 0, y = 0) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${viewBox} ${viewBox}'><path transform='translate(${x} ${y})' d='${path}'/></svg>`)}")`;
const chevron = paginationProfile.glyphs.chevron;
const text = (style: {
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: number;
}) =>
  `font-size:${rem(style.fontSize)};line-height:${style.lineHeight / style.fontSize};font-weight:${style.fontWeight};letter-spacing:${rem(style.letterSpacing)};`;

export const calendarCss = `
[data-lab-calendar] { margin:0;padding:0;border:0;position:relative;isolation:isolate;box-sizing:border-box;inline-size:100%;max-inline-size:var(--lab-calendar-width,${rem(p.sizes.s.width)});min-inline-size:0;border-radius:${rem(p.radius)};font-family:var(--lab-font-family);color:${role(p.roles.label)}; }
[data-lab-calendar]::after { content:'';position:absolute;inset:0;pointer-events:none;border:${rem(p.stroke)} solid ${role(p.roles.border)};border-radius:inherit; }
[data-lab-calendar] { container:lab-calendar / inline-size; }
.lab-calendar-surface { position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none; }
[data-lab-calendar] { --_cal-padding:${rem(p.sizes.s.padding)};--_cal-top:${rem(p.sizes.s.areaTop)};--_cal-nav:${rem(p.sizes.s.navSize)};--_cal-nav-radius:${rem(p.sizes.s.navRadius)};--_cal-cell-radius:${rem(p.sizes.s.cellRadius)};--_cal-dots-bottom:${rem(p.sizes.s.dotsBottom)}; }
[data-lab-calendar][data-size='m'] { max-inline-size:var(--lab-calendar-width,${rem(p.sizes.m.width)});--_cal-padding:${rem(p.sizes.m.padding)};--_cal-top:${rem(p.sizes.m.areaTop)};--_cal-nav:${rem(p.sizes.m.navSize)};--_cal-nav-radius:${rem(p.sizes.m.navRadius)};--_cal-cell-radius:${rem(p.sizes.m.cellRadius)};--_cal-dots-bottom:${rem(p.sizes.m.dotsBottom)}; }
.lab-calendar-header { display:flex;align-items:center;gap:${rem(p.gap)};padding:var(--_cal-padding);background:${role(p.roles.header)};border-start-start-radius:inherit;border-start-end-radius:inherit; }
.lab-calendar-title { flex:1;min-inline-size:0;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${text(p.typography.sTitle)} }
[data-size='m'] .lab-calendar-title { order:-1;text-align:start;${text(p.typography.mTitle)} }
.lab-calendar-nav { display:flex;align-items:center;justify-content:center;box-sizing:border-box;flex:none;inline-size:var(--_cal-nav);block-size:var(--_cal-nav);padding:0;border:${rem(p.stroke)} solid ${role(p.roles.border)};border-radius:var(--_cal-nav-radius);color:${role(p.roles.secondary)};background:transparent;cursor:pointer; }
.lab-calendar-nav:hover:not(:disabled) { background:${role(p.roles.hover)};color:${role(p.roles.label)}; }
.lab-calendar-nav:disabled { color:${role(p.roles.disabled)};cursor:default; }
.lab-calendar-chevron { display:block;inline-size:${rem(p.icon)};block-size:${rem(p.icon)};background:currentColor;mask:${mask(chevron.viewBox, chevron.data, chevron.x, chevron.y)} center/contain no-repeat; }
.lab-calendar-next .lab-calendar-chevron { transform:rotate(180deg); }
.lab-calendar-prev:dir(rtl) .lab-calendar-chevron { transform:rotate(180deg); }
.lab-calendar-next:dir(rtl) .lab-calendar-chevron { transform:none; }
[data-size='m'] .lab-calendar-prev .lab-calendar-chevron { transform:rotate(-90deg); }
[data-size='m'] .lab-calendar-next .lab-calendar-chevron { transform:rotate(90deg); }
.lab-calendar-area { padding:var(--_cal-top) var(--_cal-padding) var(--_cal-padding);overflow-x:auto; }
.lab-calendar-grid { display:grid;grid-template-columns:repeat(${p.columns},minmax(0,1fr));grid-template-rows:repeat(${p.weeks + 1},minmax(0,1fr));aspect-ratio:1;inline-size:100%;border:0;border-collapse:collapse;table-layout:fixed; }
.lab-calendar-grid thead,.lab-calendar-grid tbody,.lab-calendar-grid tr { display:contents; }
.lab-calendar-grid { min-inline-size:${rem(7 * p.typography.sDay.fontSize * 2)}; }
[data-size='m'] .lab-calendar-grid { min-inline-size:${rem(7 * p.typography.mDay.fontSize * 2)}; }
.lab-calendar-weekday { display:flex;align-items:center;justify-content:center;color:${role(p.roles.secondary)};padding:0;${text(p.typography.sWeekday)} }
[data-size='m'] .lab-calendar-weekday { ${text(p.typography.mWeekday)} }
.lab-calendar-cell { min-inline-size:0;min-block-size:0;position:relative;padding:0; }
.lab-calendar-day { position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box;inline-size:100%;block-size:100%;border:0;border-radius:var(--_cal-cell-radius);margin:0;padding:0;color:inherit;background:transparent;cursor:pointer;${text(p.typography.sDay)}font-family:inherit; }
[data-size='m'] .lab-calendar-day { ${text(p.typography.mDay)} }
.lab-calendar-day[data-outside-range] { color:${role(p.roles.disabled)}; }
.lab-calendar-day[aria-disabled='true'] { color:${role(p.roles.disabled)};cursor:default; }
.lab-calendar-day:hover:not([aria-disabled='true']):not([data-active]) { background:${role(p.roles.hover)}; }
.lab-calendar-day[data-active] { background:${role(p.roles.active)};color:${role(p.roles.activeLabel)}; }
.lab-calendar-day[data-range='start'] { border-start-end-radius:0;border-end-end-radius:0;padding-inline:${rem(p.range.edgePadding)} ${rem(p.range.innerPadding)}; }
.lab-calendar-day[data-range='end'] { border-start-start-radius:0;border-end-start-radius:0;padding-inline:${rem(p.range.innerPadding)} ${rem(p.range.edgePadding)}; }
.lab-calendar-day[data-range='middle'] { border-radius:0; }
.lab-calendar-day[data-range='start']::before,.lab-calendar-day[data-range='end']::before { content:'';position:absolute;inline-size:${rem(p.range.markerStroke)};block-size:${rem(p.range.markerHeight)};border-radius:${rem(p.range.markerStroke)};background:currentColor; }
.lab-calendar-day[data-range='start']::before { inset-inline-start:${rem(p.range.markerInset)}; }
.lab-calendar-day[data-range='end']::before { inset-inline-end:${rem(p.range.markerInset)}; }
.lab-calendar-nav:focus-visible { outline:${rem(p.focus.width)} solid ${role(p.roles.focus)};outline-offset:${rem(p.focus.offset)}; }
.lab-calendar-day:focus-visible { outline:none;z-index:2; }
.lab-calendar-day:focus-visible::after { content:'';position:absolute;inset:-${rem(p.focus.offset)};border:${rem(p.focus.width)} solid ${role(p.roles.focus)};border-radius:calc(var(--_cal-cell-radius) + ${rem(p.focus.offset)});pointer-events:none; }
.lab-calendar-day[data-range='start']:focus-visible::after { border-inline-end:0;border-start-end-radius:0;border-end-end-radius:0; }
.lab-calendar-day[data-range='end']:focus-visible::after { border-inline-start:0;border-start-start-radius:0;border-end-start-radius:0; }
.lab-calendar-day[data-range='middle']:focus-visible::after { border-inline:0;border-radius:0; }
.lab-calendar-dots { position:absolute;inset-block-end:var(--_cal-dots-bottom);inset-inline-start:50%;transform:translateX(-50%);inline-size:${rem(p.dots.width)};block-size:${rem(p.dots.size)};display:flex;justify-content:center;gap:0;color:${role(p.dots.roles.default)}; }
.lab-calendar-dots:dir(rtl) { transform:translateX(50%); }
.lab-calendar-dot { inline-size:${rem(p.dots.size)};block-size:${rem(p.dots.size)};flex:none;background:currentColor;mask:${mask(p.dots.glyph.viewBox, p.dots.glyph.data)} center/contain no-repeat; }
.lab-calendar-dot:first-child { mask:none;border-radius:50%; }
.lab-calendar-day[aria-disabled='true'] .lab-calendar-dots { color:${role(p.dots.roles.disabled)}; }
.lab-calendar-day[data-active] .lab-calendar-dots { color:${role(p.dots.roles.active)}; }
.lab-calendar-marker { position:absolute;display:flex;align-items:center;justify-content:center;box-sizing:border-box;inline-size:${rem(p.marker.size)};block-size:${rem(p.marker.size)};padding:${rem(p.marker.padding)};border:${rem(p.marker.stroke)} solid ${role(p.roles.border)};border-radius:50%;inset-block-end:${rem(p.marker.bottom)};z-index:1;background:${role(p.marker.surfaceRole)};color:${role(p.marker.labelRole)}; }
.lab-calendar-day[data-active] .lab-calendar-marker { background:${role(p.marker.activeSurfaceRole)};color:${role(p.marker.activeLabelRole)};border-color:${role(p.marker.activeBorderRole)}; }
.lab-calendar-validation { position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);padding:0;border:0; }
@container lab-calendar (max-width:18rem) {
  .lab-calendar-header { flex-wrap:wrap; }
  .lab-calendar-title { flex-basis:100%;order:-1;text-align:start;white-space:normal;overflow-wrap:anywhere;overflow:visible; }
  .lab-calendar-prev { margin-inline-start:auto; }
}
@media (forced-colors:active) {
  [data-lab-calendar]::after { border-color:CanvasText; }.lab-calendar-header{background:Canvas;}
  .lab-calendar-nav { color:ButtonText; }.lab-calendar-nav:disabled { color:GrayText; }
  .lab-calendar-day { color:ButtonText; }.lab-calendar-day[aria-disabled='true']{color:GrayText;}
  .lab-calendar-day[data-active] { forced-color-adjust:none;background:Highlight;color:HighlightText; }
  .lab-calendar-dots,.lab-calendar-day[data-active] .lab-calendar-dots { color:inherit; }
  .lab-calendar-chevron,.lab-calendar-dot { forced-color-adjust:none;background:currentColor; }
  .lab-calendar-day:focus-visible::after { border-color:Highlight; }.lab-calendar-nav:focus-visible { outline-color:Highlight; }
}
`;
