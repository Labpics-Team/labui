/**
 * @labpics/ui-tokens — LabUI dimension, typography and z-index tokens.
 *
 * One typed config (`./config`) is the single source of truth. A pure generator
 * (`./generate`) turns it into three artifacts with no divergence:
 *   - `tokens.css`        — `:root { --lab-* }` custom properties (the contract);
 *   - `tokens.dtcg.json`  — canonical W3C DTCG export;
 *   - generated TS tokens — typed `var(--lab-*)` references (re-exported below).
 *
 * Tokens follow the three-language split: primitives -> semantic aliases ->
 * components consume semantics only. Every scale defines an explicit zero token,
 * and typography is a continuous fluid gradient (clamp, no media queries).
 */

// Config: the single source of truth + override mechanism.
export { defaultConfig } from './config/default-config.js';
export { resolveConfig } from './config/merge.js';
export type {
  LineHeightBand,
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

export const PACKAGE_NAME = '@labpics/ui-tokens';
