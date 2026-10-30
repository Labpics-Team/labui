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
 * Типографика сочетает плавную шкалу (clamp без media queries) и фиксированные
 * роли подписей компонентов, сохраняющие rem-масштаб независимо от viewport.
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

export const PACKAGE_NAME = '@labpics/ui-tokens';
