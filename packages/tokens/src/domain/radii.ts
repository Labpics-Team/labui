import type { RadiiConfig } from '../config/types.js';
import { aliasCssRef, cssVarName } from './alias.js';
import { ROOT_FONT_SIZE_PX, px, rem } from './format.js';
import type { ResolvedAlias, ResolvedToken } from './token.js';

/** The reserved token name for the pill / fully-rounded radius. */
export const RADIUS_FULL = 'full';

/**
 * Build the radii scale: a geometric rem progression plus an explicit `full`
 * pill token and an enforced zero token.
 *
 * `full` is a semantic value (Material 3's 9999px pill), not a computed 50% — a
 * pill must stay a pill regardless of element size.
 */
export function buildRadii(config: RadiiConfig): {
  tokens: ResolvedToken[];
  aliases: ResolvedAlias[];
} {
  assertZeroStep(config);

  const stepTokens: ResolvedToken[] = Object.entries(config.steps).map(([name, value]) => ({
    kind: 'radius',
    name,
    cssValue: rem(value),
    numeric: value * ROOT_FONT_SIZE_PX,
    dtcgType: 'dimension',
  }));

  const fullToken: ResolvedToken = {
    kind: 'radius',
    name: RADIUS_FULL,
    cssValue: px(config.fullPx),
    numeric: config.fullPx,
    dtcgType: 'dimension',
    description: 'Pill / fully-rounded — a semantic constant, not computed 50%.',
  };

  const cornerToken: ResolvedToken = {
    kind: 'radius',
    name: 'corner-k',
    cssValue: String(config.cornerK),
    numeric: config.cornerK,
    dtcgType: 'number',
    description:
      'Corner shape curvature: corner-shape superellipse(K) over any radius. ' +
      '1 = circle (off), 1.1 = derived Figma smoothing zeta=0.6 equivalent, ~2.3 = Apple icon squircle.',
  };

  const tokens = [...stepTokens, fullToken, cornerToken];

  const aliases: ResolvedAlias[] = Object.entries(config.aliases).map(([name, target]) => {
    assertTargetExists(target, config.steps);
    return {
      kind: 'radius',
      name,
      target,
      cssValue:
        target === RADIUS_FULL
          ? `var(${cssVarName('radius', RADIUS_FULL)})`
          : aliasCssRef('radius', target),
    } satisfies ResolvedAlias;
  });

  return { tokens, aliases };
}

function assertZeroStep(config: RadiiConfig): void {
  const zero = config.steps['0'];
  if (zero === undefined) {
    throw new Error('radii.steps must define an explicit "0" zero token');
  }
  if (zero !== 0) {
    throw new Error(`radii zero token must be 0, got ${zero}`);
  }
}

function assertTargetExists(target: string, steps: Readonly<Record<string, number>>): void {
  if (target === RADIUS_FULL) return;
  if (!(target in steps)) {
    throw new Error(`radii alias points at missing step "${target}"`);
  }
}
