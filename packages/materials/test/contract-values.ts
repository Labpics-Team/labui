import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { themeVars } from '../../colors/test/state-overlays-shared.mjs';
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

/** Читает готовую краску выбранной CSS-ветки; цветовую математику не повторяет. */
function readDecl(section: ReadonlyMap<string, string>, name: string): string {
  const value = section.get(name);
  if (value === undefined) {
    throw new Error(`contract.css: declaration ${name} not found`);
  }
  return value.trim();
}

function readColour(section: ReadonlyMap<string, string>, name: string): Rgba {
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

  const fills = new Map<string, TierFill>();
  const labelCandidatesByTheme = new Map<ThemeName, readonly LabelCandidate[]>();

  for (const theme of ['light', 'dark'] as const) {
    const section = themeVars(css, theme);
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
