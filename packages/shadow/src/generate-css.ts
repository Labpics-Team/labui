import {
  BUTTON_INSET,
  DEFAULT_LIGHT_ANGLE_DEG,
  DEFAULT_TINT_STRENGTH,
  SHADOW_COLOR_FALLBACK_DARK,
  SHADOW_COLOR_FALLBACK_LIGHT,
  SHADOW_TRANSITION_DURATION,
  SHADOW_TRANSITION_EASING,
} from './config.js';
import { ELEVATION_ROLES, ROLE_TO_SIZE } from './domain/alias.js';
import {
  DARK_ALPHA_MULTIPLIER_DEFAULT,
  type ShadowTheme,
  defaultAlpha,
} from './domain/alpha-contract.js';
import {
  LIGHT_ANGLE_VAR,
  SHADOW_COLOR_VAR,
  TINT_STRENGTH_VAR,
  composeElevation,
} from './domain/box-shadow.js';
import { ELEVATION_SHAPES } from './domain/elevation.js';
import { SHADOW_SLOTS, type ShadowSlotName } from './domain/layer.js';

const SIZE_VAR_PREFIX = '--lab-shadow';
const SIZE_CLASS_PREFIX = 'lab-shadow';
const ROLE_VAR_PREFIX = '--lab-elevation';
const ROLE_CLASS_PREFIX = 'lab-elevation';
const TRANSITION_DURATION_VAR = '--lab-shadow-transition-duration';
const TRANSITION_EASING_VAR = '--lab-shadow-transition-easing';
const TRANSITION_VAR = '--lab-shadow-transition';

function sizeVar(name: string): string {
  return `${SIZE_VAR_PREFIX}-${name}`;
}

function alphaVarName(slot: ShadowSlotName): string {
  return `--lab-shadow-alpha-${slot}`;
}

/**
 * Generate the shadow-stack CSS contract from the verbatim owner ladder:
 * the global angle token, the neutral colour anchor + opt-in tint strength,
 * the motion tokens, the four fixed `--lab-shadow-alpha-*` contracts, the five
 * size roles (`--lab-shadow-{xs..xl}` + `.lab-shadow-*`), and the semantic
 * role aliases (`--lab-elevation-*` + `.lab-elevation-*`) onto sizes. Light and
 * dark differ ONLY in variable values (anchor + dark alpha multiplier) — the
 * box-shadow formulas are identical, so a theme switch is a variable swap.
 *
 * Deterministic and idempotent: same config in, byte-identical CSS out. At the
 * default angle (0) the size box-shadows are the opora table, ply for ply.
 */
export function generateShadowCss(): string {
  // compute-once for perf (elevations are pure; output byte-identical)
  const elevations = ELEVATION_SHAPES.map((level) => ({
    name: level.name,
    value: composeElevation(level, DEFAULT_LIGHT_ANGLE_DEG),
  }));
  return [
    header(),
    ':root {',
    rootContract(),
    sizeRoles(elevations),
    roleAliases(),
    buttonInsetRoles('light'),
    '}',
    '',
    sizeClasses(elevations),
    '',
    roleAliasClasses(elevations),
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
    ' * Five elevation sizes (XS/S/M/L/XL), each exactly four drop-shadow plies,',
    " * transcribed verbatim from the owner's Figma effect styles. Per-slot alphas",
    ' * are fixed (.12/.04/.02/.01); depth is geometry only. Default light is',
    ' * vertical (angle 0, offset-x 0). Neutral anchor #101012 (never pure black);',
    ' * surface tint is opt-in and weak. Semantic roles (resting/raised/overlay/',
    ' * modal) are aliases onto sizes.',
    ' */',
  ].join('\n');
}

function rootContract(): string {
  const lines = [
    '  /* Single global light source — angle 0 = vertical (offset-x 0), the owner default. */',
    `  ${LIGHT_ANGLE_VAR}: ${DEFAULT_LIGHT_ANGLE_DEG}deg;`,
    '',
    '  /* Neutral shadow anchor (Figma N12, never pure black). The theme blocks',
    '     re-set only its value; a surface may opt into a weak tint below. */',
    `  ${SHADOW_COLOR_VAR}: ${SHADOW_COLOR_FALLBACK_LIGHT};`,
    `  ${TINT_STRENGTH_VAR}: ${DEFAULT_TINT_STRENGTH};`,
    '',
    '  /* Motion tokens — elevation changes ease their box-shadow, never snap. */',
    `  ${TRANSITION_DURATION_VAR}: ${SHADOW_TRANSITION_DURATION};`,
    `  ${TRANSITION_EASING_VAR}: ${SHADOW_TRANSITION_EASING};`,
    `  ${TRANSITION_VAR}: box-shadow var(${TRANSITION_DURATION_VAR}) var(${TRANSITION_EASING_VAR});`,
    '',
    '  /* Per-slot alpha contract — fixed across every level, the lab-colors JND',
    '     seam. Defaults to the owner Figma alphas; the dark theme block applies a',
    '     provisional multiplier. Swapping in JND alphas = re-set these names. */',
  ];
  for (const slot of SHADOW_SLOTS) {
    lines.push(`  ${alphaVarName(slot)}: ${defaultAlpha(slot)};`);
  }
  return lines.join('\n');
}

function sizeRoles(elevations: { name: string; value: string }[]): string {
  const lines = [
    '',
    '  /* Elevation SIZES — the primitive. Each is the owner ladder, four plies. */',
  ];
  for (const e of elevations) {
    lines.push(`  ${sizeVar(e.name)}:\n    ${e.value};`);
  }
  return lines.join('\n');
}

function roleAliases(): string {
  const lines = [
    '',
    '  /* Semantic ROLE aliases — a role points to a size (size is the primitive). */',
  ];
  for (const role of ELEVATION_ROLES) {
    const size = ROLE_TO_SIZE[role];
    lines.push(`  ${ROLE_VAR_PREFIX}-${role}: var(${sizeVar(size)});`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Size utility classes set `box-shadow` DIRECTLY (and wire the transition), so
 * the opt-in surface-tint var inside each ply resolves on the consuming ELEMENT.
 * A surface that sets `--lab-surface-shadow-tint` + raises the tint strength
 * tints its own shadow; the token form carries the neutral anchor.
 */
function sizeClasses(elevations: { name: string; value: string }[]): string {
  const lines = [
    '/* Size classes — set box-shadow directly so an opt-in --lab-surface-shadow-tint',
    '   resolves at the element, and ease elevation changes via the motion token. */',
  ];
  for (const e of elevations) {
    lines.push(
      `.${SIZE_CLASS_PREFIX}-${e.name} {\n  box-shadow:\n    ${e.value};\n  transition: var(${TRANSITION_VAR});\n}`,
    );
  }
  return lines.join('\n');
}

/** Role classes alias size classes — same geometry, semantic name. */
function roleAliasClasses(_elevations: { name: string; value: string }[]): string {
  const lines = ['/* Role classes — semantic alias onto the size class box-shadow. */'];
  // Note: role aliases still use sizeVar for var() indirection; elevations precomp used for sizes
  for (const role of ELEVATION_ROLES) {
    const size = ROLE_TO_SIZE[role];
    lines.push(
      `.${ROLE_CLASS_PREFIX}-${role} {\n  box-shadow: var(${sizeVar(size)});\n  transition: var(${TRANSITION_VAR});\n}`,
    );
  }
  return lines.join('\n');
}

/**
 * A theme block overrides only what differs: the colour anchor and (dark only)
 * the provisional alpha multiplier applied to every slot. The geometry never
 * changes. Targets both an explicit `[data-theme]` and the OS preference.
 */
function themeBlock(theme: ShadowTheme): string {
  const anchor = theme === 'light' ? SHADOW_COLOR_FALLBACK_LIGHT : SHADOW_COLOR_FALLBACK_DARK;
  const multiplier = theme === 'dark' ? DARK_ALPHA_MULTIPLIER_DEFAULT : 1;
  const alphaLines = SHADOW_SLOTS.map(
    (slot) => `  ${alphaVarName(slot)}: ${round(defaultAlpha(slot) * multiplier)};`,
  );
  const colorLine = `  ${SHADOW_COLOR_VAR}: ${anchor};`;
  const body = [colorLine, ...alphaLines, buttonInsetRoles(theme)].join('\n');

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

/** Весь box-shadow публикуется в каждом scope: вложенная тема обновляет paint. */
function buttonInsetRoles(theme: ShadowTheme): string {
  const offset = BUTTON_INSET.offsetPx / 16;
  const blur = BUTTON_INSET.blurPx / 16;
  const paint = `color-mix(in srgb, var(--lab-bg-static-dark) ${BUTTON_INSET.alpha[theme] * 100}%, transparent)`;
  return [
    '',
    '  /* Button: внутренний край меняет направление при нажатии. */',
    `  --lab-shadow-button: inset 0 -${offset}rem ${blur}rem 0 ${paint};`,
    `  --lab-shadow-button-pressed: inset 0 ${offset}rem ${blur}rem 0 ${paint};`,
  ].join('\n');
}

function round(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`shadow alpha produced a non-finite value: ${value}`);
  }
  return Math.round(value * 10000) / 10000;
}

function indent(block: string): string {
  return block
    .split('\n')
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join('\n');
}
