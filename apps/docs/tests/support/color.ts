import type { Page } from '@playwright/test';

/**
 * Чтение резолвнутого цвета в e2e — единый способ.
 *
 * ПОЧЕМУ отдельный примитив: движок цвета labui эмитит роли в `oklch()` (CSS
 * Color 4), и `getComputedStyle` СОХРАНЯЕТ этот синтаксис. Node-сторона,
 * парсящая цвет регэкспом «только rgb/rgba», молча получает NaN (как в
 * shadow.spec) или мусор (`oklch(L C H)` → числа L/C/H, принятые за r/g/b).
 * Это повторяющийся класс дефектов — здесь он закрыт: цвет нормализует сам
 * БРАУЗЕР, тем же кодом, каким кладёт пиксель на экран, а не наш конвертер.
 *
 * Тот же приём уже применяет support/axe.ts (canvas-нормализация фона/лейбла) —
 * общий, отревьюенный способ в этом репо. Потребитель (shadow.spec) сравнивает
 * лишь ПОРЯДОК светимости (тень темнее поверхности), а порядок сохраняет любая
 * монотонная нормализация — поэтому даже возможная ±1-байтовая неточность
 * canvas на краях не может инвертировать вердикт (разрыв тень/поверхность в
 * разы шире байта). Это не абсолютный контраст, где важна точность байта.
 */

/** sRGB-цвет: каналы 0..255, straight-альфа 0..1. */
export interface Srgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Нормализует ЛЮБУЮ валидную CSS Color 4 строку (oklch/oklab/lab/lch/hsl/
 * color(srgb …)/rgb …) в целочисленный sRGB руками браузера.
 *
 * Механизм: 2d-canvas парсит любой валидный цвет в `fillStyle`; красим 1px и
 * читаем байты через `getImageData`. `getImageData` отдаёт STRAIGHT
 * (непремультиплированную) альфу, поэтому r/g/b — истинные каналы краски, а
 * альфа — отдельно (для сравнения ПО ЦВЕТУ без композитинга).
 *
 * Возвращает `null`, если строка не парсится браузером. Невалидное присваивание
 * `fillStyle` молча игнорируется, поэтому валидность ловим ДВУМЯ разными
 * сентинелами: валидный цвет не может сериализоваться в оба сразу, значит если
 * после присваивания fillStyle осел на РАЗНЫХ сентинелах — строка невалидна.
 * (Один сентинел давал бы false-negative для входа, который сам сериализуется
 * в него, — критично для примитива, заявленного как единый способ.)
 */
export async function normalizeCssColor(page: Page, raw: string): Promise<Srgb | null> {
  return page.evaluate((color) => {
    if (!color) return null;
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.canvas.width = 1;
    ctx.canvas.height = 1;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#010203';
    ctx.fillStyle = color;
    const first = ctx.fillStyle;
    ctx.fillStyle = '#040506';
    ctx.fillStyle = color;
    if (ctx.fillStyle !== first) return null; // осел на разных сентинелах → невалиден
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0] ?? 0, g: d[1] ?? 0, b: d[2] ?? 0, a: (d[3] ?? 255) / 255 };
  }, raw);
}

/**
 * Относительная светимость по WCAG 2.1 (sRGB → линеаризация). Альфа
 * игнорируется — светимость есть свойство самого цвета, не его прозрачности.
 */
export function relativeLuminance({ r, g, b }: Srgb): number {
  const linearise = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}
