import { expect, test } from '@playwright/test';

/**
 * Corner shape — суперэллипсная форма угла как часть токен-слоя.
 *
 * Ручка `--lab-radius-corner-k` (дефолт 1.1 — выведенный эквивалент Figma
 * corner smoothing ζ=0.6) применяется универсальным правилом tokens.css в
 * light DOM и листом LabElement.finalizeStyles в каждом shadow root.
 * Класс-риск, который этот сьют держит: `corner-shape` НЕ наследуется, а слои
 * материала (ободок/зерно) живут на `border-radius: inherit` — расхождение
 * формы панели и её слоёв было бы визуальным дефектом, невидимым юнит-тестам.
 * Поверхность-проба — `surface-card` флаг-демо (`_fixtures/materials-flag.html`); старая
 * страница `materials.html` снесена вместе с core-шимами (#41).
 *
 * В браузерах без поддержки (webkit на сегодня) computed-значение пустое —
 * сьют честно скипается: там свойство игнорируется целиком и ломаться нечему.
 */

const CORNER = (k: string) => `superellipse(${k})`;

async function cornerShape(
  page: import('@playwright/test').Page,
  selector: string,
  pseudo?: string,
): Promise<string> {
  return page.evaluate(
    ([sel, ps]) => {
      const el = document.querySelector(sel as string);
      if (!el) return 'MISSING';
      return getComputedStyle(el, (ps as string) || undefined)
        .getPropertyValue('corner-shape')
        .trim();
    },
    [selector, pseudo ?? ''],
  );
}

test('стекло: панель и её слои несут одну форму угла (light DOM)', async ({ page }) => {
  await page.goto('/_fixtures/materials-flag.html');
  // Меряем в режиме glass — именно там у поверхности появляются слои.
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-material', 'glass');
  });
  const pane = await cornerShape(page, '[data-testid="surface-card"]');
  test.skip(pane === '', 'браузер без corner-shape — свойство игнорируется целиком');
  expect(pane).toBe(CORNER('1.1'));
  // Слои на border-radius: inherit обязаны совпасть с формой панели —
  // иначе клип панели суперэллипсный, а ободок/зерно круглые.
  expect(await cornerShape(page, '[data-testid="surface-card"]', '::before')).toBe(pane);
  expect(await cornerShape(page, '[data-testid="surface-card"]', '::after')).toBe(pane);
});

test('shadow DOM: компоненты получают форму через LabElement', async ({ page }) => {
  await page.goto('/badge.html');
  const inner = await page.evaluate(() => {
    const host = document.querySelector('lab-badge');
    const root = host?.shadowRoot;
    const el = root?.querySelector('*');
    if (!el) return 'MISSING';
    return getComputedStyle(el as Element)
      .getPropertyValue('corner-shape')
      .trim();
  });
  test.skip(inner === '', 'браузер без corner-shape');
  expect(inner).toBe(CORNER('1.1'));
});

test('ручка токена управляет формой (identity-настройка клиента)', async ({ page }) => {
  await page.goto('/_fixtures/materials-flag.html');
  const before = await cornerShape(page, '[data-testid="surface-card"]');
  test.skip(before === '', 'браузер без corner-shape');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-radius-corner-k', '2.3');
  });
  expect(await cornerShape(page, '[data-testid="surface-card"]')).toBe(CORNER('2.3'));
});
