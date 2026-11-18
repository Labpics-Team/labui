import { shadowProfile } from '@labpics/ui-shadow';
import { tabsProfile as p } from '@labpics/ui-tokens';

const rem = (px: number) => `${px / 16}rem`;
const role = (name: string) => `var(--lab-${name})`;
const activeShadow = `var(--lab-shadow-${p.activeShadow}, ${shadowProfile.levels[p.activeShadow]
  ?.map(
    (shadow) =>
      `${rem(shadow.x)} ${rem(shadow.y)} ${rem(shadow.blur)} ${rem(shadow.spread)} color-mix(in srgb, ${role(shadow.colorRole)} ${shadow.opacity * 100}%, transparent)`,
  )
  .join(', ')})`;
const sizes = Object.entries(p.sizes)
  .map(
    ([size, m]) => `
[data-lab-tabs][data-size="${size}"] {
  --_tabs-padding: ${rem(m.padding)}; --_tabs-radius: ${rem(m.radius)};
  --_tabs-gap: ${rem(m.gap)}; --_tabs-icon: ${rem(m.iconSize)}; --_tabs-icon-only: ${rem(m.iconOnlySize)};
  --_tabs-font: ${rem(m.fontSize)}; --_tabs-leading: ${m.lineHeight / m.fontSize};
  --_tabs-weight: ${m.fontWeight}; --_tabs-tracking: ${m.letterSpacing}em;
  --_tabs-height: ${rem(m.height)}; --_tabs-baseline: ${rem(m.baseline)};
}`,
  )
  .join('\n');

/** Authored geometry and roles are shared by the light-DOM and shadow renderers. */
export const tabsCss = `
[data-lab-tabs] {
  display: flex; flex-direction: column; gap: 1rem; min-inline-size: 0;
  color: ${role(p.roles.label)};
}
${sizes}
[data-lab-tabs] > .lab-tabs-list {
  display: flex; flex: none; position: relative; min-inline-size: 0; max-inline-size: 100%;
  overflow-x: auto; overflow-y: hidden; scrollbar-width: thin;
  box-sizing: border-box; padding: 0; margin: 0;
}
[data-lab-tabs][data-variant="tinted"] > .lab-tabs-list {
  padding: ${rem(p.list.padding)}; margin: 0;
  border-radius: ${rem(p.list.radius)}; background: ${role(p.roles.track)}; corner-shape: round;
}
[data-lab-tabs][data-variant="tinted"][data-orientation="horizontal"][data-count="4"] > .lab-tabs-list {
  padding: ${rem(p.list.fourHorizontalPadding)};
}
[data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger {
  appearance: none; box-sizing: border-box; position: relative; isolation: isolate;
  display: inline-flex; flex: 1 0 0; min-inline-size: max-content; min-block-size: var(--_tabs-height); align-items: center; justify-content: center;
  gap: var(--_tabs-gap); padding: var(--_tabs-padding); margin: 0; border: 0;
  border-radius: var(--_tabs-radius); corner-shape: round;
  background: transparent; color: ${role(p.roles.inactiveLabel)};
  font-family: var(--lab-font-family); font-size: var(--_tabs-font); line-height: var(--_tabs-leading);
  font-weight: var(--_tabs-weight); letter-spacing: var(--_tabs-tracking); text-align: start;
  white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
[data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger:hover:not(:disabled):not([data-selected]) {
  background: ${role(p.roles.hover)}; color: ${role(p.roles.label)};
}
[data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger[data-selected] { color: ${role(p.roles.label)}; }
[data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger:disabled { color: ${role(p.roles.disabledLabel)}; cursor: not-allowed; }
.lab-tabs-trigger > .lab-tabs-active {
  position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit; corner-shape: round;
}
[data-lab-tabs][data-variant="tinted"] > .lab-tabs-list > .lab-tabs-trigger[data-selected] > .lab-tabs-active {
  background: ${role(p.roles.activeFill)}; box-shadow: ${activeShadow};
}
[data-lab-tabs][data-variant="tinted"] > .lab-tabs-list > .lab-tabs-trigger:not(:first-child):not([data-selected])::before {
  content: ''; position: absolute; inset-block: ${rem(p.list.separatorInset)}; inset-inline-start: 0;
  inline-size: ${rem(p.strokeWidth)}; background: ${role(p.roles.border)};
}
[data-lab-tabs][data-variant="tinted"] > .lab-tabs-list > .lab-tabs-trigger[data-selected] + .lab-tabs-trigger::before { display: none; }
[data-lab-tabs][data-variant="underlined"] > .lab-tabs-list > .lab-tabs-trigger { border-radius: var(--_tabs-radius) var(--_tabs-radius) 0 0; }
[data-lab-tabs][data-variant="underlined"][data-edge="start"] > .lab-tabs-list > .lab-tabs-trigger { border-radius: 0 0 var(--_tabs-radius) var(--_tabs-radius); }
[data-lab-tabs][data-variant="underlined"] > .lab-tabs-list > .lab-tabs-trigger > .lab-tabs-active {
  inset-block-start: auto; block-size: ${rem(p.strokeWidth)}; border-radius: 0; background: ${role(p.roles.border)};
}
[data-lab-tabs][data-variant="underlined"][data-edge="start"] > .lab-tabs-list > .lab-tabs-trigger > .lab-tabs-active { inset-block-start: 0; inset-block-end: auto; }
[data-lab-tabs][data-variant="underlined"] > .lab-tabs-list > .lab-tabs-trigger[data-selected] > .lab-tabs-active {
  background: ${role(p.roles.indicator)}; box-shadow: ${activeShadow};
}
.lab-tabs-trigger > .lab-tabs-icon { display: inline-flex; flex: none; inline-size: var(--_tabs-icon); block-size: var(--_tabs-icon); }
.lab-tabs-trigger > .lab-tabs-icon > * { inline-size: 100%; block-size: 100%; }
.lab-tabs-trigger[data-icon-only] { --_tabs-icon: var(--_tabs-icon-only); }
.lab-tabs-trigger[data-icon-only] > .lab-tabs-label { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
[data-lab-tabs][data-size="m"][data-variant="underlined"][data-orientation="horizontal"][data-edge="end"] > .lab-tabs-list > .lab-tabs-trigger[data-icon-only] {
  --_tabs-icon: ${rem(p.underlined.bottomIconOnlySize)};
  min-block-size: calc(var(--_tabs-padding) * 2 + var(--_tabs-icon));
}
[data-lab-tabs][data-orientation="vertical"] { flex-direction: row; flex-wrap: wrap; align-items: flex-start; }
[data-lab-tabs][data-orientation="vertical"] > .lab-tabs-list { flex-direction: column; flex: 0 1 auto; }
[data-lab-tabs][data-orientation="vertical"] > .lab-tabs-list > .lab-tabs-trigger { flex: none; }
[data-lab-tabs][data-orientation="vertical"][data-variant="tinted"] > .lab-tabs-list > .lab-tabs-trigger:not(:first-child):not([data-selected])::before {
  inset-block-start: 0; inset-block-end: auto; inset-inline: 0; inline-size: auto; block-size: ${rem(p.strokeWidth)};
}
[data-lab-tabs][data-orientation="vertical"][data-variant="underlined"] > .lab-tabs-list > .lab-tabs-trigger {
  border-radius: 0; border-start-start-radius: var(--_tabs-radius); border-end-start-radius: var(--_tabs-radius);
}
[data-lab-tabs][data-orientation="vertical"][data-variant="underlined"][data-edge="start"] > .lab-tabs-list > .lab-tabs-trigger {
  border-radius: 0; border-start-end-radius: var(--_tabs-radius); border-end-end-radius: var(--_tabs-radius);
}
[data-lab-tabs][data-orientation="vertical"][data-variant="underlined"] > .lab-tabs-list > .lab-tabs-trigger > .lab-tabs-active {
  inset-block: 0; inset-inline-start: auto; inset-inline-end: 0; block-size: auto; inline-size: ${rem(p.strokeWidth)};
}
[data-lab-tabs][data-orientation="vertical"][data-variant="underlined"][data-edge="start"] > .lab-tabs-list > .lab-tabs-trigger > .lab-tabs-active { inset-inline-start: 0; inset-inline-end: auto; }
[data-lab-tabs] > .lab-tabs-panel { flex: 1 1 auto; min-inline-size: 0; max-inline-size: 100%; overflow-wrap: anywhere; }
[data-lab-tabs][data-orientation="vertical"] > .lab-tabs-panel { flex-basis: 10em; }
[data-lab-tabs] > .lab-tabs-panel[hidden] { display: none; }
@supports (text-box-trim: trim-both) {
  .lab-tabs-trigger:not([data-icon-only]) > .lab-tabs-label {
    text-box-trim: trim-both; text-box-edge: cap alphabetic;
    margin-block-start: calc(var(--_tabs-baseline) - 1cap);
    margin-block-end: calc(1lh - var(--_tabs-baseline));
  }
}
[data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger:focus-visible,
[data-lab-tabs] > .lab-tabs-panel:focus-visible { outline: ${rem(p.focus.width)} solid var(--lab-border-focus); outline-offset: ${rem(p.focus.offset)}; }
[data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger:focus-visible { outline-offset: -${rem(p.focus.width)}; }
@media (forced-colors: active) {
  [data-lab-tabs] > .lab-tabs-list { background: Canvas; }
  [data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger { color: ButtonText; }
  [data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger:disabled { color: GrayText; }
  [data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger[data-selected] { color: Highlight; outline: 1px solid Highlight; outline-offset: -1px; }
  [data-lab-tabs] > .lab-tabs-list > .lab-tabs-trigger:focus-visible { outline: 2px solid Highlight; }
}
`;
