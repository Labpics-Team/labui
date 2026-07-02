import type { SpacingConfig } from '../config/types.js';
import { ROOT_FONT_SIZE_PX, num, rem } from './format.js';
import type { ResolvedAlias, ResolvedToken } from './token.js';
import { aliasCssRef } from './alias.js';

/**
 * Build the spacing scale: a linear multiplier on a rem base.
 *
 * Each step `N` resolves to `baseRem * N` rem (Tailwind v4 model). The zero
 * token is enforced: step `"0"` must exist and resolve to exactly 0.
 */
export function buildSpacing(config: SpacingConfig): {
  tokens: ResolvedToken[];
  aliases: ResolvedAlias[];
} {
  assertZeroStep(config);

  const tokens: ResolvedToken[] = Object.entries(config.steps).map(([name, multiplier]) => {
    const value = config.baseRem * multiplier;
    return {
      kind: 'space',
      name,
      cssValue: rem(value),
      numeric: value * ROOT_FONT_SIZE_PX,
      dtcgType: 'dimension',
    } satisfies ResolvedToken;
  });

  const aliases: ResolvedAlias[] = Object.entries(config.aliases).map(([name, target]) => {
    assertTargetExists('spacing', target, config.steps);
    return {
      kind: 'space',
      name,
      target,
      cssValue: aliasCssRef('space', target),
    } satisfies ResolvedAlias;
  });

  return { tokens, aliases };
}

function assertZeroStep(config: SpacingConfig): void {
  const zero = config.steps['0'];
  if (zero === undefined) {
    throw new Error('spacing.steps must define an explicit "0" zero token');
  }
  if (config.baseRem * zero !== 0) {
    throw new Error(`spacing zero token must resolve to 0, got ${num(config.baseRem * zero)}rem`);
  }
}

function assertTargetExists(
  scale: string,
  target: string,
  steps: Readonly<Record<string, number>>,
): void {
  if (!(target in steps)) {
    throw new Error(`${scale} alias points at missing step "${target}"`);
  }
}
