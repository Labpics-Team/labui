import type { OpacityConfig } from '../config/types.js';
import { aliasCssRef } from './alias.js';
import { num } from './format.js';
import type { ResolvedAlias, ResolvedToken } from './token.js';

/**
 * Build the opacity scale: unitless [0..1] fractions (задача 13).
 *
 * Громкие отказы — в культуре guards генератора (см. spacing/zindex):
 *  - явный нулевой токен `"0"` обязан существовать (zero-token mandate эпика);
 *  - каждое значение конечно и лежит в [0, 1] — иначе это не непрозрачность;
 *  - ЧИСЛОВОЕ имя ступени обязано равняться значению ×100 («45» → 0.45), чтобы
 *    имя-процент не разошлось со значением молча (нечисловые имена легальны);
 *  - алиас обязан указывать на существующую ступень.
 */
export function buildOpacity(config: OpacityConfig): {
  tokens: ResolvedToken[];
  aliases: ResolvedAlias[];
} {
  assertZeroStep(config);

  const tokens: ResolvedToken[] = Object.entries(config.steps).map(([name, value]) => {
    assertFraction(name, value);
    return {
      kind: 'opacity',
      name,
      cssValue: num(value),
      numeric: value,
      dtcgType: 'number',
    } satisfies ResolvedToken;
  });

  const aliases: ResolvedAlias[] = Object.entries(config.aliases).map(([name, target]) => {
    if (!(target in config.steps)) {
      throw new Error(`opacity alias "${name}" points at missing step "${target}"`);
    }
    return {
      kind: 'opacity',
      name,
      target,
      cssValue: aliasCssRef('opacity', target),
    } satisfies ResolvedAlias;
  });

  return { tokens, aliases };
}

function assertZeroStep(config: OpacityConfig): void {
  if (config.steps['0'] === undefined) {
    throw new Error('opacity.steps must define an explicit "0" zero token');
  }
}

function assertFraction(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`opacity step "${name}" must be a finite fraction in [0, 1], got ${value}`);
  }
  const percent = Number(name);
  if (Number.isFinite(percent) && Math.abs(percent - value * 100) > 1e-9) {
    throw new Error(
      `opacity step "${name}" must equal its percent name: expected ${percent / 100}, got ${value}`,
    );
  }
}
