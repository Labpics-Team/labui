/**
 * @labpics/ui-tokens вЂ” LabUI dimension, typography and z-index tokens.
 *
 * One typed config (`./config`) is the single source of truth. A pure generator
 * (`./generate`) turns it into three artifacts with no divergence:
 *   - `tokens.css`        вЂ” `:root { --lab-* }` custom properties (the contract);
 *   - `tokens.dtcg.json`  вЂ” canonical W3C DTCG export;
 *   - generated TS tokens вЂ” typed `var(--lab-*)` references (re-exported below).
 *
 * Tokens follow the three-language split: primitives -> semantic aliases ->
 * components consume semantics only. Every scale defines an explicit zero token,
 * and typography is a continuous fluid gradient (clamp, no media queries).
 */

// Config: the single source of truth + override mechanism.
export { defaultConfig } from './config/default-config.js';
export { resolveConfig } from './config/merge.js';
export type {
  OpacityConfig,
  RadiiConfig,
  SizesConfig,
  SpacingConfig,
  TokensConfig,
  TokensConfigOverride,
  TypographyConfig,
  ZIndexConfig,
} from './config/types.js';
export { TOKEN_PREFIX } from './config/types.js';

// Generator: build-time API (pure, idempotent).
export {
  generate,
  generateFromOverride,
  type GeneratedArtifacts,
} from './generate/index.js';

// Generated typed tokens: `var(--lab-*)` references with literal-union types.
export * from './generated/tokens.js';

// Motion runtime surface: committed static references only. Physical primitives
// are consumed from @labpics/motion at build time and never become a runtime
// dependency of @labpics/ui-tokens.
export * from './generated/motion.js';
export { snackbarProfile } from './snackbar.js';
export { cardProfile } from './card.js';
export { switchProfile } from './switch.js';

export const PACKAGE_NAME = '@labpics/ui-tokens';

export { badgeProfile } from './badge.js';
export { selectionProfile } from './selection.js';
export { kbdProfile } from './kbd.js';
export { loaderProfile, progressProfile } from './progress.js';

export { chipProfile } from './chip.js';
export { tabsProfile } from './tabs.js';
export { breadcrumbProfile } from './breadcrumb.js';
export { paginationProfile } from './pagination.js';
export { accordionProfile } from './accordion.js';

export { segmentedProfile } from './segmented.js';

export { selectProfile } from './select.js';

export { avatarProfile } from './avatar.js';
export { dragButtonProfile } from './drag-button.js';

export { pinInputProfile } from './pin-input.js';

export { sliderProfile } from './slider.js';

export { tooltipProfile } from './tooltip.js';

export { alertProfile } from './alert.js';
export { menuProfile } from './menu.js';
export { dialogProfile } from './dialog.js';

export { fileUploadProfile } from './file-upload.js';
export { colorPickerProfile } from './color-picker.js';
