import { selectionProfile as p, textStyle } from '@labpics/ui-tokens';
import { slotSizeCss } from '../../slot-projection.js';

const rem = (px: number): string => `${px / 16}rem`;
const role = (name: string): string => `var(--lab-${name})`;
const selected = ':is(:has(input:checked), [data-indeterminate])';
const mark = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.checkbox.glyph.viewBox} ${p.checkbox.glyph.viewBox}"><path fill-rule="${p.checkbox.glyph.windingRule.toLowerCase()}" d="${p.checkbox.glyph.data}"/></svg>`)}")`;
// Image masks consume alpha, so their opaque coverage does not depend on theme.
const radioMask = `
[data-lab-selection][data-kind="radio"]:not([data-size="tiny"]) .lab-selection-control::before {
  mask: radial-gradient(circle closest-side, transparent calc(100% - var(--_selection-radio-stroke)), black 0);
}
`;
const forcedColors = `
@media (forced-colors: active) {
  [data-lab-selection] .lab-selection-control { forced-color-adjust: none; background: Canvas; border: 1px solid ButtonText; }
  [data-lab-selection]:is(:has(input:checked), [data-indeterminate]) .lab-selection-control { background: Highlight; }
  [data-lab-selection] .lab-selection-mark { background: HighlightText; }
  [data-lab-selection][data-kind="radio"]:is(:has(input:checked), [data-indeterminate]) .lab-selection-control { background: Canvas; border-color: Highlight; }
  [data-lab-selection]:has(input:focus-visible) { --_selection-focus: Highlight; }
}
`;

/** One authored visual path for Lit, React and Choicebox's Check/Radio. */
export const selectionCss = `
[data-lab-selection] {
  --_selection-color: ${role(p.roles.accent)};
  --_selection-focus: ${role(p.roles.focusAccent)};
  --_selection-fill: ${role(p.roles.uncheckedFill)};
  --_selection-glyph: ${role(p.roles.glyph)};
  --_selection-gradient: none;
  --_selection-shadow: none;
  --_selection-stroke: ${role(p.roles.uncheckedStroke)};
  box-sizing: border-box; position: relative; display: inline-flex; flex-wrap: wrap; align-items: center;
  max-inline-size: 100%; min-inline-size: 0; vertical-align: middle;
  color: ${role(p.roles.label)}; font-family: var(--lab-font-family);
  cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: manipulation;
}
${Object.entries(p.sizes)
  .map(
    ([size, m]) => `
[data-lab-selection][data-size="${size}"] {
  --_selection-size: ${rem(m.controlSize)};
  --_selection-radius: ${rem(m.checkboxRadius)};
  --_selection-glyph-size: ${rem(m.glyphSize)};
  --_selection-mixed-height: ${rem(m.mixedHeight)};
  --_selection-mixed-y: ${rem(m.mixedY)};
  --_selection-radio-stroke: ${rem(m.radioStroke)};
  --_selection-radio-focus-stroke: ${rem(m.radioFocusStroke)};
  --_selection-tiny-dot: ${rem(m.tinyDot)};
  min-block-size: ${rem(m.controlHeight)}; gap: ${rem(m.labelGap)};
  font-size: ${rem(m.fontSize)}; line-height: ${m.lineHeight / m.fontSize};
  font-weight: ${m.fontWeight}; letter-spacing: ${m.letterSpacing / m.fontSize}em;
}`,
  )
  .join('\n')}
[data-lab-selection][data-type="neutral"] { --_selection-color: ${role(p.roles.neutral)}; --_selection-focus: ${role(p.roles.focusNeutral)}; }
[data-lab-selection][data-type="neutral"][data-kind="checkbox"]:not([data-size="tiny"]):not([data-disabled]):not(:has(input:disabled)) { --_selection-glyph: ${role(p.roles.neutralGlyph)}; }
[data-lab-selection][data-type="danger"] { --_selection-color: ${role(p.roles.danger)}; --_selection-focus: ${role(p.roles.focusDanger)}; }
[data-lab-selection]:not(${selected}) { --_selection-focus: ${role(p.roles.focusNeutral)}; }
[data-lab-selection]:hover:not([data-disabled]):not(:has(input:disabled)) { --_selection-fill: ${role(p.roles.uncheckedHoverFill)}; }
[data-lab-selection]${selected} {
  --_selection-fill: var(--_selection-color); --_selection-stroke: transparent;
}
[data-lab-selection]${selected}[data-kind="checkbox"]:not([data-size="tiny"]):not([data-disabled]):not(:has(input:disabled)) {
  --_selection-gradient: linear-gradient(to bottom, color-mix(in srgb, ${role('bg-static-light')} ${p.fill.highlight * 100}%, transparent), transparent);
  --_selection-shadow: inset ${rem(p.checkbox.innerShadow.x)} ${rem(p.checkbox.innerShadow.y)} ${rem(p.checkbox.innerShadow.blur)} ${role(p.checkbox.innerShadow.colorRole)};
}
[data-lab-selection]${selected}[data-kind="checkbox"]:hover:not([data-disabled]):not(:has(input:disabled)):not([data-size="tiny"]) {
  --_selection-gradient: linear-gradient(to bottom, color-mix(in srgb, ${role('bg-static-light')} ${p.fill.hoverHighlight * 100}%, transparent), transparent);
}
[data-lab-selection] .lab-selection-control {
  box-sizing: border-box; position: relative; flex: none;
  inline-size: var(--_selection-size); block-size: var(--_selection-size);
  border-radius: var(--_selection-radius); corner-shape: round;
  background-color: var(--_selection-fill); background-image: var(--_selection-gradient);
  box-shadow: var(--_selection-shadow); border: 1px solid var(--_selection-stroke);
}
[data-lab-selection]${selected} .lab-selection-control { border: 0; }
[data-lab-selection][data-kind="radio"] .lab-selection-control { border-radius: var(--lab-radius-circle); corner-shape: round; }
[data-lab-selection][data-kind="radio"]${selected} .lab-selection-control {
  background: transparent; border: var(--_selection-radio-stroke) solid var(--_selection-color);
}
[data-lab-selection][data-kind="radio"]${selected}:not([data-size="tiny"]) .lab-selection-control::before {
  content: ""; position: absolute; inset: calc(-1 * var(--_selection-radio-stroke)); border-radius: var(--lab-radius-circle); corner-shape: round;
  background: linear-gradient(to bottom, color-mix(in srgb, ${role('bg-static-light')} ${p.fill.highlight * 100}%, transparent), transparent);
  opacity: var(--_selection-reveal, 1);
}
[data-lab-selection][data-kind="radio"]${selected}:not([data-size="tiny"]):hover:not([data-disabled]):not(:has(input:disabled)) .lab-selection-control::before {
  background: linear-gradient(to bottom, color-mix(in srgb, ${role('bg-static-light')} ${p.fill.hoverHighlight * 100}%, transparent), transparent);
}
[data-lab-selection][data-kind="radio"][data-type="accent"]${selected}:has(input:focus-visible) .lab-selection-control { --_selection-radio-stroke: var(--_selection-radio-focus-stroke); }
[data-lab-selection][data-kind="radio"][data-disabled] .lab-selection-control::before, [data-lab-selection][data-kind="radio"]:has(input:disabled) .lab-selection-control::before { display: none; }
[data-lab-selection][data-kind="radio"][data-type="accent"]${selected}:has(input:focus-visible) .lab-selection-control { border-width: var(--_selection-radio-focus-stroke); }
[data-lab-selection] .lab-selection-mark {
  position: absolute; inline-size: var(--_selection-glyph-size); block-size: var(--_selection-glyph-size);
  inset-inline-start: calc((100% - var(--_selection-glyph-size)) / 2); inset-block-start: calc((100% - var(--_selection-glyph-size)) / 2);
  background: var(--_selection-glyph); mask: ${mark} center / contain no-repeat;
  opacity: var(--_selection-reveal, 0);
}
[data-lab-selection]${selected} .lab-selection-mark { opacity: var(--_selection-reveal, 1); }
[data-lab-selection][data-indeterminate] .lab-selection-mark {
  block-size: var(--_selection-mixed-height); inset-block-start: var(--_selection-mixed-y); mask: none; border-radius: var(--_selection-mixed-height);
}
[data-lab-selection][data-kind="radio"] .lab-selection-mark { display: none; }
[data-lab-selection][data-size="tiny"] .lab-selection-control { border: 0; background: transparent; box-shadow: none; }
[data-lab-selection][data-size="tiny"] .lab-selection-mark { --_selection-glyph: var(--_selection-color); }
[data-lab-selection][data-size="tiny"]:not([data-disabled]):not(:has(input:disabled)) .lab-selection-mark { background-image: linear-gradient(to bottom, color-mix(in srgb, ${role('bg-static-light')} ${p.fill.highlight * 100}%, transparent), transparent); }
[data-lab-selection][data-size="tiny"]:hover:not([data-disabled]):not(:has(input:disabled)) .lab-selection-mark { background-image: linear-gradient(to bottom, color-mix(in srgb, ${role('bg-static-light')} ${p.fill.hoverHighlight * 100}%, transparent), transparent); }
[data-lab-selection][data-kind="radio"][data-size="tiny"]${selected} .lab-selection-control { border: 0; background: transparent; }
[data-lab-selection][data-kind="radio"][data-size="tiny"] .lab-selection-mark {
  display: block; inline-size: var(--_selection-tiny-dot); block-size: var(--_selection-tiny-dot); mask: none; border-radius: var(--lab-radius-circle); corner-shape: round;
  inset: calc((100% - var(--_selection-tiny-dot)) / 2);
}
[data-lab-selection]:has(input:focus-visible) .lab-selection-control { outline: ${rem(p.focus.width)} solid var(--_selection-focus); outline-offset: ${rem(p.focus.offset)}; }
[data-lab-selection][data-size="tiny"]:has(input:focus-visible) .lab-selection-control { outline-offset: ${rem(p.focus.tinyCheckboxOffset)}; }
[data-lab-selection][data-kind="radio"][data-size="tiny"]:has(input:focus-visible) .lab-selection-control { outline-offset: ${rem(p.focus.tinyRadioOffset)}; }
[data-lab-selection][data-disabled], [data-lab-selection]:has(input:disabled) {
  --_selection-fill: ${role(p.roles.disabledFill)}; --_selection-glyph: ${role(p.roles.disabledGlyph)};
  --_selection-gradient: none; --_selection-shadow: none; --_selection-color: ${role(p.roles.disabledFill)};
  --_selection-stroke: transparent; color: ${role(p.roles.disabledLabel)}; cursor: not-allowed;
}
[data-lab-selection][data-size="tiny"][data-kind="checkbox"][data-disabled] .lab-selection-mark,
[data-lab-selection][data-size="tiny"][data-kind="checkbox"]:has(input:disabled) .lab-selection-mark { --_selection-glyph: ${role(p.roles.disabledLabel)}; }
[data-lab-selection][data-size="tiny"][data-kind="checkbox"][data-type="neutral"][data-disabled] .lab-selection-mark,
[data-lab-selection][data-size="tiny"][data-kind="checkbox"][data-type="neutral"]:has(input:disabled) .lab-selection-mark { --_selection-glyph: ${role(p.checkbox.tinyDisabledNeutralGlyphRole)}; }
[data-lab-selection] .lab-selection-label, [data-lab-selection] .lab-selection-label-start { min-inline-size: 0; overflow-wrap: anywhere; }
[data-lab-selection] .lab-selection-label-start:has(slot:empty) { display: contents; }
[data-lab-selection][data-variant="plain"] .lab-selection-label { display: contents; }
[data-lab-selection][data-variant="plain"] .lab-selection-label > span { max-inline-size: 100%; }
[data-lab-selection][data-variant="plain"] .lab-selection-label > .lab-selection-description { display: contents; }
[data-lab-selection] .lab-selection-description { display: block; font-size: ${textStyle.body.fontSize}; line-height: ${textStyle.body.lineHeight}; font-weight: ${textStyle.body.fontWeight}; letter-spacing: ${textStyle.body.letterSpacing}; color: ${role(p.choicebox.descriptionRole)}; overflow-wrap: anywhere; }
[data-lab-selection] input { position: absolute; inline-size: 1px; block-size: 1px; margin: -1px; padding: 0; border: 0; clip-path: inset(50%); overflow: hidden; white-space: nowrap; }
[data-lab-selection] .lab-selection-icon { display: none; }
[data-lab-radio-group] { display: flex; flex-wrap: wrap; gap: var(--lab-space-md); min-inline-size: 0; max-inline-size: 100%; padding: 0; margin: 0; border: 0; }
[data-lab-radio-group][data-orientation="vertical"] { flex-direction: column; align-items: flex-start; }
.lab-selection-group-label { flex: 1 0 100%; min-inline-size: 0; font: inherit; color: ${role(p.roles.label)}; overflow-wrap: anywhere; }
[data-lab-selection]:is([data-variant="card"], [data-variant="row"]) {
  --_choicebox-radius: ${rem(p.choicebox.radius)};
  display: grid; flex: 1 1 ${rem(p.choicebox.preferredWidth)}; inline-size: ${rem(p.choicebox.preferredWidth)};
  container: lab-choicebox / inline-size;
  max-inline-size: 100%; padding: ${rem(p.choicebox.padding)}; border-radius: var(--_choicebox-radius);
  corner-shape: superellipse(var(--lab-radius-corner-k, 1.1));
  box-shadow: inset 0 0 0 ${rem(p.choicebox.strokeWidth)} ${role(p.choicebox.strokeRole)};
  font-size: ${rem(p.choicebox.fontSize)}; line-height: ${p.choicebox.lineHeight / p.choicebox.fontSize};
  font-weight: ${p.choicebox.fontWeight}; letter-spacing: ${p.choicebox.letterSpacing / p.choicebox.fontSize}em;
}
[data-lab-selection][data-variant="card"] { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "icon control" "label label"; gap: ${rem(p.choicebox.cardContentGap)}; min-block-size: ${rem(p.choicebox.cardHeight)}; align-content: start; }
[data-lab-selection][data-variant="row"] { grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: "icon label control"; column-gap: ${rem(p.choicebox.rowContentGap)}; min-block-size: ${rem(p.choicebox.rowHeight)}; }
[data-lab-selection][data-variant="row"] .lab-selection-control { margin-inline-start: ${rem(p.choicebox.headerGap - p.choicebox.rowContentGap)}; }
[data-lab-selection]:is([data-variant="card"], [data-variant="row"])${selected} { box-shadow: inset 0 0 0 ${rem(p.choicebox.selectedStrokeWidth)} ${role(p.choicebox.selectedStrokeRole)}; }
[data-lab-selection]:is([data-variant="card"], [data-variant="row"]):hover:not([data-disabled]):not(:has(input:disabled)) { background: ${role(p.choicebox.hoverFillRole)}; }
[data-lab-selection]:is([data-variant="card"], [data-variant="row"]) .lab-selection-control { grid-area: control; }
[data-lab-selection]:is([data-variant="card"], [data-variant="row"]) .lab-selection-label { grid-area: label; }
[data-lab-selection]:is([data-variant="card"], [data-variant="row"]) .lab-selection-icon { display: flex; grid-area: icon; inline-size: ${rem(p.choicebox.iconSize)}; block-size: ${rem(p.choicebox.iconSize)}; color: ${role(p.choicebox.iconRole)}; }
[data-lab-selection] .lab-selection-icon:empty { visibility: hidden; }
${slotSizeCss('[data-lab-selection] .lab-selection-icon > *, [data-lab-selection] .lab-selection-icon ::slotted(*)', '100%', '100%')}
[data-lab-selection]:is([data-variant="card"], [data-variant="row"])[data-disabled],
[data-lab-selection]:is([data-variant="card"], [data-variant="row"]):has(input:disabled) { box-shadow: inset 0 0 0 ${rem(p.choicebox.strokeWidth)} ${role(p.choicebox.strokeRole)}; }
[data-lab-selection][data-disabled] :is(.lab-selection-description, .lab-selection-icon), [data-lab-selection]:has(input:disabled) :is(.lab-selection-description, .lab-selection-icon) { color: ${role(p.roles.disabledLabel)}; }
[data-lab-selection]:is([data-variant="card"], [data-variant="row"]):has(input:focus-visible) { outline: ${rem(p.focus.width)} solid var(--_selection-focus); outline-offset: ${rem(p.focus.offset)}; }
[data-lab-selection]:is([data-variant="card"], [data-variant="row"]):has(input:focus-visible) .lab-selection-control { outline: none; }
@container lab-choicebox (max-width: ${rem(p.choicebox.rowWrapWidth)}) {
  [data-lab-selection][data-variant="row"] .lab-selection-icon { grid-area: 1 / 1; }
  [data-lab-selection][data-variant="row"] .lab-selection-control { grid-area: 1 / 3; }
  [data-lab-selection][data-variant="row"] .lab-selection-label { grid-area: 2 / 1 / 3 / -1; margin-block-start: ${rem(p.choicebox.cardContentGap)}; }
}
${radioMask}
${forcedColors}
`;
