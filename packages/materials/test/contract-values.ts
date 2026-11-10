import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveValue, themeVars } from '../../colors/test/state-overlays-shared.mjs';
import { type Rgba, parseRgb } from '../src/luminance';
import {
  type LabelCandidate,
  MATERIAL_TIERS,
  type ThemeName,
  type TierFill,
  fillKey,
} from '../src/material-guarantee';

// Читаем готовые значения generated contract через общий разбор его формата.
// Материалы не хранят копию красок и не зависят от расположения CSS-блоков тем.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const CONTRACT_PATH = resolve(repoRoot, 'packages/colors/contract.css');

function readColour(vars: ReadonlyMap<string, string>, name: string): Rgba {
  if (!vars.has(name)) {
    throw new Error(`contract.css: declaration ${name} not found`);
  }
  const raw = resolveValue(name, vars);
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
export function readContractMaterials(
  css = readFileSync(CONTRACT_PATH, 'utf8'),
  contrast: 'normal' | 'more' = 'normal',
): ContractMaterials {
  const fills = new Map<string, TierFill>();
  const labelCandidatesByTheme = new Map<ThemeName, readonly LabelCandidate[]>();

  for (const theme of ['light', 'dark'] as const) {
    const vars = themeVars(css, theme, contrast);
    for (const tier of MATERIAL_TIERS) {
      fills.set(fillKey(theme, tier), {
        tint: readColour(vars, `--lab-bg-material-${tier}-01`),
        base: readColour(vars, `--lab-bg-material-${tier}-02`),
      });
    }
    // Material panels carry a STATIC (theme-pinned) label; polarity picks white
    // or near-black by the surface's own luminance. Both are the contract's
    // static families — the guaranteed foreground tokens for a material surface.
    labelCandidatesByTheme.set(theme, [
      {
        name: 'static-light-primary',
        colour: readColour(vars, '--lab-label-static-light-primary'),
      },
      {
        name: 'static-dark-primary',
        colour: readColour(vars, '--lab-label-static-dark-primary'),
      },
    ]);
  }

  return { fills, labelCandidatesByTheme };
}
