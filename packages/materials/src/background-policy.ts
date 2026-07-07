/*
 * A. Политика фонов — явный контракт «какой материал что читает и во что
 * вкладывается» (ADR-0002 §1 «флаги эффектов», ADR-0004 Решение 4 «вложенность
 * материалов»). Чистый домен: ни DOM, ни CSS — только правила над модами, чтобы
 * инвариант был исчерпаемо тестируем и переиспользуем адаптером-потребителем
 * (e2e-проверка вложенности, будущий рантайм-гвард).
 *
 * Два класса правил:
 *   1. Кто читает ЖИВОЙ фон (live-blur): glass / blur / acrylic — полупрозрачный
 *      тинт над `backdrop-filter`. solid — непрозрачный, живого фона не читает.
 *   2. Вложенность: live-blur нельзя вкладывать в live-blur. Два наложенных
 *      живых блюра = видимый шов/striping (как glass-on-glass в README). solid
 *      прозрачности не несёт, поэтому вкладывается свободно в обе стороны.
 */

import type { MaterialMode } from './material-guarantee';

export type { MaterialMode };

/**
 * Моды, читающие ЖИВОЙ фон через `backdrop-filter` (полупрозрачный тинт над
 * реальным содержимым за поверхностью). Ровно дополнение `solid` до полного
 * множества мод — единственная точка истины «что есть live-blur».
 */
export const LIVE_BLUR_MODES = ['glass', 'blur', 'acrylic'] as const;

/** Единственное семейство токенов, из которого материал берёт СВОЮ заливку
 * (тинт 01 + база 02). Живой фон-хозяин ПОД стеклом — любая bg-роль (сцена), но
 * это фон, а не заливка поверхности: границу держит скан material.css в тестах. */
export const MATERIAL_FILL_FAMILY = '--lab-bg-material-' as const;

const LIVE_BLUR_SET: ReadonlySet<MaterialMode> = new Set(LIVE_BLUR_MODES);

/** Читает ли мода живой фон (полупрозрачна над `backdrop-filter`). */
export function isLiveBlur(mode: MaterialMode): boolean {
  return LIVE_BLUR_SET.has(mode);
}

/**
 * Можно ли материал моды `inner` разместить ВНУТРИ материала моды `outer`?
 * Запрещена ровно одна ситуация — live-blur внутри live-blur (двойной живой
 * блюр даёт шов). Любая комбинация с участием `solid` разрешена: непрозрачный
 * хозяин отсекает фон снизу, непрозрачный вложенный не добавляет второго блюра.
 */
export function canNest(outer: MaterialMode, inner: MaterialMode): boolean {
  return !(isLiveBlur(outer) && isLiveBlur(inner));
}
