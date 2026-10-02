import type { StatesConfig } from '../config/types.js';
import type { ResolvedToken } from './token.js';

/** Documented purpose of each state-overlay step (intent next to the value). */
const STEP_PURPOSE: Readonly<Record<string, string>> = {
  hover: 'Доля тинта рецепта D, подмешиваемая в роль покоя на hover.',
  pressed: 'Доля тинта рецепта D в нажатом состоянии — глубже hover.',
};

/**
 * Build the state-overlay fraction tokens (#109).
 *
 * Состояние — НЕ новый цвет: это роль покоя, сдвинутая на фиксированную долю
 * к тинту рецепта D через `color-mix(in oklab, <роль>, <тинт> <доля>)`
 * (docs/vocabulary.md, раздел «Стейт-оверлеи»). Доли — единственные ручки этой
 * формы, поэтому живут здесь первоклассными токенами; оба CI-гейта
 * (state-overlay-contrast / state-overlay-muddiness в @labpics/ui-colors) читают их
 * из СГЕНЕРИРОВАННОГО tokens.css — никогда из литерала в компоненте.
 */
export function buildStates(config: StatesConfig): ResolvedToken[] {
  assertConfig(config);

  return (['hover', 'pressed'] as const).map(
    (name) =>
      ({
        kind: 'state',
        name,
        cssValue: `${config[name]}%`,
        numeric: config[name] / 100,
        dtcgType: 'number',
        description: STEP_PURPOSE[name],
      }) satisfies ResolvedToken,
  );
}

function assertConfig(config: StatesConfig): void {
  for (const key of ['hover', 'pressed'] as const) {
    const v = config[key];
    if (!Number.isFinite(v) || v <= 0 || v >= 100) {
      throw new Error(`states.${key} must be a percentage in (0, 100), got ${v}`);
    }
  }
  if (config.pressed <= config.hover) {
    throw new Error(
      `states.pressed (${config.pressed}) must exceed states.hover (${config.hover}) — pressed углубляет ту же форму, а не спорит с ней`,
    );
  }
}
