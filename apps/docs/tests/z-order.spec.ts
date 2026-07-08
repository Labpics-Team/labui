import { type Page, expect, test } from '@playwright/test';

/**
 * z-order (наложения) — доказательство, что 15-уровневая z-шкала @labpics/ui-tokens
 * доезжает до DOM живым браузером и держит порядок слоёв «как сейчас»: скрим ПОД
 * панелью модала (underlay 1100 < modal 1200), dropdown ПОД модалом (900), tooltip
 * НАД всем (1400).
 *
 * Разделение с гейтом: статический no-magic-zindex доказывает, ЧТО каждый компонент
 * кладётся на именованный слой шкалы (а не на голое число). Этот smoke — единственное,
 * что он не может: что имя резолвится в значение шкалы в живом рендере и относительный
 * порядок сохранён. Поэтому здесь НЕ переоткрываются все компоненты (дубль-нагрузка):
 * один живой рендер модала (scrim+панель, оба position:fixed → z computed) закрепляет
 * резолв имя→значение, а порядок остальных слоёв читается из :root-лестницы.
 */

/** Числовое значение --lab-z-* c :root страницы (контракт tokens.css в DOM). */
async function rootZ(page: Page, name: string): Promise<number> {
  const raw = await page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );
  return Number.parseInt(raw, 10);
}

test.describe('z-index scale reaches the DOM and preserves stacking order', () => {
  test('the 15 --lab-z-* layers are the gap-100 ladder in the DOM (primary 0 … tooltip 1400)', async ({
    page,
  }) => {
    await page.goto('/dialog.html');
    const names = [
      'primary',
      'secondary',
      'tertiary',
      'quaternary',
      'grouped-primary',
      'grouped-secondary',
      'grouped-tertiary',
      'inverted',
      'skip-link',
      'dropdown',
      'sticky',
      'modal-underlay',
      'modal',
      'toast',
      'tooltip',
    ];
    const values: number[] = [];
    for (const n of names) values.push(await rootZ(page, `--lab-z-${n}`));

    expect(values[0], 'primary is the zero layer').toBe(0);
    expect(values[values.length - 1], 'tooltip is the top layer').toBe(1400);
    // Строго монотонная лестница с шагом 100: место под вставку слоя без перенумерации.
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBe((values[i - 1] as number) + 100);
    }
  });

  test('modal dialog: the scrim renders UNDER the panel (underlay 1100 < modal 1200), computed in-browser', async ({
    page,
  }) => {
    await page.goto('/dialog.html');
    const host = page.getByTestId('lit-dialog');
    const portal = page.locator('[data-portal-for="lit-dialog"]');

    await host.locator('.trigger').click();
    await expect(portal.locator('.content')).toBeVisible();

    // .backdrop (скрим) и .positioner (слой панели) — оба position:fixed, поэтому их
    // computed z-index — реальное число стека, а не 'auto'.
    const scrimZ = await portal.locator('.backdrop').evaluate((el) => getComputedStyle(el).zIndex);
    const modalZ = await portal
      .locator('.positioner')
      .evaluate((el) => getComputedStyle(el).zIndex);

    expect(scrimZ, 'scrim resolves --lab-z-modal-underlay').toBe('1100');
    expect(modalZ, 'panel layer resolves --lab-z-modal').toBe('1200');
    expect(Number(scrimZ), 'scrim sits BELOW the panel').toBeLessThan(Number(modalZ));
  });

  test('overlay matrix: dropdown < modal-underlay < modal < tooltip (the layers components use)', async ({
    page,
  }) => {
    await page.goto('/dialog.html');
    const dropdown = await rootZ(page, '--lab-z-dropdown');
    const underlay = await rootZ(page, '--lab-z-modal-underlay');
    const modal = await rootZ(page, '--lab-z-modal');
    const tooltip = await rootZ(page, '--lab-z-tooltip');

    expect(dropdown, 'anchored menus/selects/comboboxes/popovers').toBe(900);
    expect(tooltip, 'top-most hint layer').toBe(1400);
    // dropdown ПОД модалом; скрим ПОД панелью; tooltip НАД всем — «как сейчас».
    expect(dropdown).toBeLessThan(underlay);
    expect(underlay).toBeLessThan(modal);
    expect(modal).toBeLessThan(tooltip);
  });
});
