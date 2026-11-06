import { type Page, expect, test } from '@playwright/test';
import { modalFocus } from './helpers/modal-focus.js';

const host = (page: Page, id: string) => page.getByTestId(id);
const portal = (page: Page, id: string) => page.locator(`[data-portal-for="${id}"]`);
const content = (page: Page, id: string) => portal(page, id).locator('.content');

async function open(page: Page, id: string): Promise<void> {
  await host(page, id).locator('.trigger').click();
  await expect(content(page, id)).toBeVisible();
  await expect
    .poll(() =>
      portal(page, id)
        .evaluate(modalFocus)
        .then((focus) => focus.inside),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('/_fixtures/modal-live.html');
  await expect(page.locator('html')).toHaveAttribute('data-modal-live-ready', 'true');
});

for (const id of ['sheet', 'dialog', 'alert']) {
  test(`${id}: CSS media query меняет контекст уже открытой поверхности`, async ({ page }) => {
    await open(page, id);
    await expect(content(page, id)).toHaveCSS('color', 'rgb(11, 22, 33)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(host(page, id)).toHaveCSS('--lab-label-primary', 'rgb(44 55 66)');
    await expect(content(page, id)).toHaveCSS('color', 'rgb(44, 55, 66)');
  });

  test(`${id}: CSSOM меняет локальные роли и шрифт без DOM-мутации`, async ({ page }) => {
    await open(page, id);
    await page.evaluate(() => {
      const sheet = (document.getElementById('local-rules') as HTMLStyleElement).sheet;
      const rule = sheet?.cssRules[0] as CSSStyleRule;
      rule.style.setProperty('--lab-label-primary', 'rgb(77 88 99)');
      rule.style.setProperty('font-family', 'monospace');
    });
    await expect(content(page, id)).toHaveCSS('color', 'rgb(77, 88, 99)');
    await expect(content(page, id)).toHaveCSS('font-family', 'monospace');
  });

  test(`${id}: replaceChildren отзывает прежнее содержимое потребителя`, async ({ page }) => {
    await open(page, id);
    await expect(host(page, id).locator(`#${id}-content`)).toBeVisible();
    await host(page, id).evaluate((element) => element.replaceChildren('Открыть снова'));
    await expect(host(page, id).locator(`#${id}-content`)).toHaveCount(0);
    if (id === 'sheet') {
      await expect
        .poll(() => content(page, id).evaluate((panel) => panel.getBoundingClientRect().top))
        .toBe(772);
    }
    await page.keyboard.press('Escape');
    await expect(content(page, id)).toBeHidden();
    await expect(host(page, id).locator('.trigger')).toBeFocused();
  });
}

test('Sheet: CSSOM меняет геометрию открытого Flex', async ({ page }) => {
  await open(page, 'sheet');
  await expect
    .poll(() => content(page, 'sheet').evaluate((panel) => panel.getBoundingClientRect().top))
    .toBe(648);
  await page.evaluate(() => {
    const sheet = (document.getElementById('local-rules') as HTMLStyleElement).sheet;
    const rule = sheet?.cssRules[0] as CSSStyleRule;
    rule.style.setProperty('--lab-size-sheet-drag-area', '40px');
    rule.style.setProperty('--lab-space-sheet-gap', '32px');
  });
  await expect(portal(page, 'sheet').locator('.handle')).toHaveCSS('height', '40px');
  await expect
    .poll(() => content(page, 'sheet').evaluate((panel) => panel.getBoundingClientRect().top))
    .toBe(624);
});

test('Sheet: transform и clipping предка сохраняют viewport, pointer и Zag focus', async ({
  page,
}) => {
  await page.locator('#local-context').evaluate((element) => {
    (element as HTMLElement).style.cssText =
      'position:absolute;left:33px;top:55px;width:160px;height:90px;overflow:hidden;transform:translateZ(0)';
  });
  await open(page, 'sheet');
  await expect
    .poll(() => content(page, 'sheet').evaluate((panel) => panel.getBoundingClientRect().top))
    .toBe(648);
  const box = await content(page, 'sheet').boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.width).toBe(375);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBe(812);
  await portal(page, 'sheet').locator('.handle').click();
  await expect(host(page, 'sheet')).toHaveAttribute('position', 'one-third');
  await expect
    .poll(() => content(page, 'sheet').evaluate((panel) => panel.getBoundingClientRect().top))
    .toBe(542);
  await page.keyboard.press('Escape');
  await expect(content(page, 'sheet')).toBeHidden();
  await expect(host(page, 'sheet').locator('.trigger')).toBeFocused();
});

test('Vue Sheet: пустой именованный slot возвращает Flex к одной ручке', async ({ page }) => {
  await open(page, 'vue');
  await expect
    .poll(() => content(page, 'vue').evaluate((panel) => panel.getBoundingClientRect().top))
    .toBe(648);
  await page.evaluate(() => window.modalLiveFixture.setVueContent(false));
  await expect(host(page, 'vue').locator('#vue-content')).toHaveCount(0);
  await expect
    .poll(() => content(page, 'vue').evaluate((panel) => panel.getBoundingClientRect().top))
    .toBe(772);
  await page.evaluate(() => window.modalLiveFixture.setVueContent(true));
  await expect(host(page, 'vue').locator('#vue-content')).toBeVisible();
  await expect
    .poll(() => content(page, 'vue').evaluate((panel) => panel.getBoundingClientRect().top))
    .toBe(648);
});
