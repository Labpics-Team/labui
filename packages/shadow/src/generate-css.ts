import {
  DEFAULT_LIGHT_ANGLE_DEG,
  SHADOW_COLOR_FALLBACK_DARK,
  SHADOW_COLOR_FALLBACK_LIGHT,
} from './config.js';
import { type ShadowTheme, provisionalAlpha } from './domain/alpha-contract.js';
import { LIGHT_ANGLE_VAR, SHADOW_COLOR_VAR, composeElevation } from './domain/box-shadow.js';
import { ELEVATION_SHAPES } from './domain/elevation.js';
import { alphaVar } from './domain/elevation.js';
import { LAYER_SHAPES, SHADOW_LAYERS } from './domain/layer.js';

/**
 * Generate the shadow-stack CSS contract: the global angle token, the
 * surface-tint shadow colour, the `--lab-shadow-alpha-*` runtime contract (stub:
 * Figma provisional values), and the four `--lab-elevation-*` roles composed
 * from the four layers. Light and dark themes differ ONLY in variable values
 * (alphas + colour anchor) — the elevation `box-shadow` formulas are identical,
 * so switching theme is a variable swap, never a re-author.
 *
 * Deterministic and idempotent: same config in, byte-identical CSS out.
 */
export function generateShadowCss(): string {
  return [
    header(),
    ':root {',
    rootContract(),
    elevationRoles(),
    '}',
    '',
    elevationClasses(),
    '',
    themeBlock('light'),
    '',
    themeBlock('dark'),
    '',
  ].join('\n');
}

function header(): string {
  return [
    '/*',
    ' * LabUI shadow stack — GENERATED. Do not edit by hand.',
    ' * Source: packages/shadow/src (config + generator). Run',
    ' * `pnpm --filter @labpics/ui-shadow build` to regenerate.',
    ' *',
    ' * Layered box-shadow stack (Minor/Ambient/Penumbra/Major), surface-tinted',
    ' * (never pure black), one global light angle, alphas through the',
    ' * --lab-shadow-alpha-* contract (stub = Figma provisional; final = lab-colors',
    ' * JND calibration, swapped in at the same names).',
    ' */',
  ].join('\n');
}

function rootContract(): string {
  const lines = [
    '  /* Single global light source — every elevation derives x/y offset from this. */',
    `  ${LIGHT_ANGLE_VAR}: ${DEFAULT_LIGHT_ANGLE_DEG}deg;`,
    '',
    '  /* Theme shadow-colour anchor. A per-surface --lab-surface-shadow-tint (from',
    '     the --lab-* core contract) overrides this at the element; absent that, the',
    '     shadow falls back to this theme dark anchor — never a hardcoded #000. */',
    `  ${SHADOW_COLOR_VAR}: ${SHADOW_COLOR_FALLBACK_LIGHT};`,
    '',
    '  /* Per-layer alpha contract — integration seam with lab-colors JND alphas.',
    '     Defaults to the light-theme Figma provisional values; the theme blocks',
    '     below override per theme. Swapping in JND alphas = re-set these names. */',
  ];
  for (const layer of SHADOW_LAYERS) {
    lines.push(`  ${alphaVar(layer)}: ${provisionalAlpha('light', layer)};`);
  }
  return lines.join('\n');
}

function elevationRoles(): string {
  const lines = [
    '',
    '  /* Semantic elevation roles — a surface consumes a role, never raw layers.',
    '     Each is the same four-ply stack scaled by one depth + alpha damping. */',
  ];
  for (const level of ELEVATION_SHAPES) {
    const value = composeElevation(level, LAYER_SHAPES);
    lines.push(`  --lab-elevation-${level.name}:\n    ${value};`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Elevation utility classes. A class sets `box-shadow` DIRECTLY, so the
 * surface-tint `var()` inside each ply resolves on the consuming ELEMENT — a
 * `.card` that sets `--lab-surface-shadow-tint` tints its own shadow.
 *
 * This is the difference that matters: a `var()` nested inside a custom property
 * (`--lab-elevation-*`) is substituted in the scope where the property is
 * DECLARED (`:root`), so the token form always carries the theme anchor tint.
 * The class form is the per-surface-tint path. A surface picks whichever role
 * delivery it wants — both are the same four-ply geometry.
 */
function elevationClasses(): string {
  const lines = [
    '/* Elevation role classes — set box-shadow directly so a per-surface',
    '   --lab-surface-shadow-tint resolves at the element (the tinted-shadow path). */',
  ];
  for (const level of ELEVATION_SHAPES) {
    const value = composeElevation(level, LAYER_SHAPES);
    lines.push(`.lab-elevation-${level.name} {\n  box-shadow:\n    ${value};\n}`);
  }
  return lines.join('\n');
}

/**
 * A theme block overrides only the values that differ between light and dark:
 * the per-layer alphas and the shadow-colour fallback anchor. Selector targets
 * both an explicit `[data-theme]` and the OS preference, so the stack themes
 * with the rest of LabUI without owning the theme switch itself.
 */
function themeBlock(theme: ShadowTheme): string {
  const anchor = theme === 'light' ? SHADOW_COLOR_FALLBACK_LIGHT : SHADOW_COLOR_FALLBACK_DARK;
  const alphaLines = SHADOW_LAYERS.map(
    (layer) => `  ${alphaVar(layer)}: ${provisionalAlpha(theme, layer)};`,
  );
  const colorLine = `  ${SHADOW_COLOR_VAR}: ${anchor};`;
  const body = [colorLine, ...alphaLines].join('\n');

  if (theme === 'light') {
    return `[data-theme="light"] {\n${body}\n}`;
  }
  return [
    `[data-theme="dark"] {\n${body}\n}`,
    '',
    '@media (prefers-color-scheme: dark) {',
    `  :root:not([data-theme="light"]) {\n${indent(body)}\n  }`,
    '}',
  ].join('\n');
}

function indent(block: string): string {
  return block
    .split('\n')
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join('\n');
}
