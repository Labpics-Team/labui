import type { SizesConfig } from '../config/types.js';
import { aliasCssRef } from './alias.js';
import { ROOT_FONT_SIZE_PX, rem } from './format.js';
import type { ResolvedAlias, ResolvedToken } from './token.js';

/**
 * Сборка шкалы размеров контролов: абсолютные rem-ступени оси размера
 * компонента (`s | m | l`), той же формы, что ступени радиусов.
 *
 * Нулевая ступень не заводится (в отличие от spacing/radii): контрол нулевого
 * размера — вырожденное состояние, которое ни один компонент не должен
 * потреблять, поэтому ступень `0` была бы ловушкой, а не удобством.
 */
export function buildSizes(config: SizesConfig): {
  tokens: ResolvedToken[];
  aliases: ResolvedAlias[];
} {
  const tokens: ResolvedToken[] = Object.entries(config.steps).map(([name, value]) => ({
    kind: 'size',
    name,
    cssValue: rem(value),
    numeric: value * ROOT_FONT_SIZE_PX,
    dtcgType: 'dimension',
  }));

  const aliases: ResolvedAlias[] = Object.entries(config.aliases).map(([name, target]) => {
    if (!(target in config.steps)) {
      throw new Error(`sizes alias points at missing step "${target}"`);
    }
    return {
      kind: 'size',
      name,
      target,
      cssValue: aliasCssRef('size', target),
    } satisfies ResolvedAlias;
  });

  return { tokens, aliases };
}
