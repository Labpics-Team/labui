import { readFile } from 'node:fs/promises';

import { scopes } from './labui-program-shared.mjs';

export const GLOW_FAMILIES = ['neutral', 'brand', 'danger', 'warning'];
export const FOCUS_FAMILIES = [...GLOW_FAMILIES, 'success', 'info'];
export const EXPECTED_FX_ROLES = [
  ...[...GLOW_FAMILIES, 'inverted'].map((family) => `--lab-fx-glow-${family}`),
  ...FOCUS_FAMILIES.map((family) => `--lab-fx-focus-ring-${family}`),
  '--lab-fx-skeleton-highlight',
].sort();

// Точное снятие r5: 36 дополнительных ступеней + 12 core/alpha + 2 base.
export const RETIRED_FX_ROLES = [
  ...FOCUS_FAMILIES.flatMap((family) =>
    ['subtle', 'bloom'].flatMap((step) =>
      ['', '-core', '-alpha'].map((suffix) => `--lab-fx-glow-${family}-${step}${suffix}`),
    ),
  ),
  ...FOCUS_FAMILIES.flatMap((family) =>
    ['-core', '-alpha'].map((suffix) => `--lab-fx-glow-${family}${suffix}`),
  ),
  '--lab-fx-glow-success',
  '--lab-fx-glow-info',
].sort();

export const RETIRED_REFERENCE_ROLES = new Set(
  ['minor', 'ambient', 'penumbra', 'major'].map((name) => `--lab-fx-shadow-${name}`),
);

/** Независимый экспорт Figma и явно объявленные связи новых badge-потребителей. */
export async function authoredReference() {
  const result = scopes(await readFile(new URL('../figma-reference.css', import.meta.url), 'utf8'));
  for (const vars of result) {
    for (const family of [
      'brand',
      'danger',
      'warning',
      'success',
      'info',
      'static-dark',
      'static-light',
    ]) {
      vars.set(
        `--lab-badge-fill-${family}`,
        family.startsWith('static-')
          ? `var(--lab-label-${family}-primary)`
          : `var(--lab-border-${family}-strong)`,
      );
      vars.set(
        `--lab-badge-label-on-${family}`,
        family === 'static-light'
          ? 'var(--lab-label-static-dark-primary)'
          : 'var(--lab-label-static-light-primary)',
      );
    }
  }
  return result;
}
