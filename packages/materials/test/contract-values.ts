import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Rgba, parseRgb } from '../src/luminance';
import {
  type LabelCandidate,
  MATERIAL_TIERS,
  type ThemeName,
  type TierFill,
  fillKey,
} from '../src/material-guarantee';

/*
 * Adapter (Clean Architecture): read the material tier fills and the material
 * label candidates straight from the GENERATED contract, so the guarantee test
 * carries no second copy of the numbers — it re-checks whatever the colours
 * train currently emits. When the provisional Figma alphas are replaced with
 * engine-derived ones, this test automatically re-evaluates them.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const CONTRACT_PATH = resolve(repoRoot, 'packages/colors/contract.css');

/** Split the contract into its light and dark theme sections (ignoring the
 * duplicated `@media (prefers-color-scheme)` block). */
function themeSections(css: string): Record<ThemeName, string> {
  const darkStart = css.indexOf('[data-theme="dark"]');
  const mediaStart = css.indexOf('@media', darkStart);
  if (darkStart < 0) {
    throw new Error('contract.css: no [data-theme="dark"] block found');
  }
  const light = css.slice(0, darkStart);
  const dark = css.slice(darkStart, mediaStart < 0 ? undefined : mediaStart);
  return { light, dark };
}

/** Read a `--<name>: <value>;` declaration's value from a CSS section. */
function readDecl(section: string, name: string): string {
  const match = section.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  const value = match?.[1];
  if (value === undefined) {
    throw new Error(`contract.css: declaration ${name} not found`);
  }
  return value.trim();
}

function readColour(section: string, name: string): Rgba {
  const raw = readDecl(section, name);
  const rgba = parseRgb(raw);
  if (rgba === null) {
    throw new Error(
      `contract.css: ${name} = "${raw}" could not be parsed as a straight-alpha colour`,
    );
  }
  return rgba;
}

export interface ContractMaterials {
  readonly fills: ReadonlyMap<string, TierFill>;
  readonly labelCandidatesByTheme: ReadonlyMap<ThemeName, readonly LabelCandidate[]>;
}

/** Parse the material tier fills + polarity label candidates from the contract. */
export function readContractMaterials(): ContractMaterials {
  const css = readFileSync(CONTRACT_PATH, 'utf8');
  const sections = themeSections(css);

  const fills = new Map<string, TierFill>();
  const labelCandidatesByTheme = new Map<ThemeName, readonly LabelCandidate[]>();

  for (const theme of ['light', 'dark'] as const) {
    const section = sections[theme];
    for (const tier of MATERIAL_TIERS) {
      fills.set(fillKey(theme, tier), {
        tint: readColour(section, `--lab-bg-material-${tier}-01`),
        base: readColour(section, `--lab-bg-material-${tier}-02`),
      });
    }
    // Material panels carry a STATIC (theme-pinned) label; polarity picks white
    // or near-black by the surface's own luminance. Both are the contract's
    // static families — the guaranteed foreground tokens for a material surface.
    labelCandidatesByTheme.set(theme, [
      {
        name: 'static-light-primary',
        colour: readColour(section, '--lab-label-static-light-primary'),
      },
      {
        name: 'static-dark-primary',
        colour: readColour(section, '--lab-label-static-dark-primary'),
      },
    ]);
  }

  return { fills, labelCandidatesByTheme };
}
