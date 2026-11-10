/** AA проверяет публичный more; normal отдельно сохраняет authored LabUI v2.1.
 * Цветовой скан выполняется при reduced motion, чтобы не измерять промежуточный transition.
 * Поведение анимаций проверяется в сценариях соответствующих компонентов.
 */
import { type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';
import { assertAxeAA, assertLabelContrast } from './support/axe.js';

const COMPONENT_FIXTURES = [
  { path: '/button.html', label: 'Button', hasReactIsland: true },
  { path: '/badge.html', label: 'Badge', hasReactIsland: true },
  { path: '/kbd.html', label: 'Kbd', hasReactIsland: true },
  { path: '/loader.html', label: 'Loader', hasReactIsland: true },
  { path: '/avatar.html', label: 'Avatar', hasReactIsland: true },
  { path: '/switch.html', label: 'Switch', hasReactIsland: true },
  { path: '/checkbox.html', label: 'Checkbox', hasReactIsland: true },
  { path: '/input.html', label: 'Input', hasReactIsland: true },
  { path: '/textarea.html', label: 'Textarea', hasReactIsland: true },
  { path: '/number-input.html', label: 'NumberInput', hasReactIsland: true },
  { path: '/slider.html', label: 'Slider', hasReactIsland: true },
  { path: '/tooltip.html', label: 'Tooltip', hasReactIsland: true },
  { path: '/popover.html', label: 'Popover', hasReactIsland: true },
  { path: '/dialog.html', label: 'Dialog', hasReactIsland: true },
  { path: '/alert-dialog.html', label: 'AlertDialog', hasReactIsland: true },
  { path: '/tabs.html', label: 'Tabs', hasReactIsland: true },
  { path: '/breadcrumb.html', label: 'Breadcrumb', hasReactIsland: true },
  { path: '/pagination.html', label: 'Pagination', hasReactIsland: true },
  { path: '/radio-group.html', label: 'RadioGroup', hasReactIsland: true },
  { path: '/accordion.html', label: 'Accordion', hasReactIsland: true },
  { path: '/card.html', label: 'Card', hasReactIsland: true },
  { path: '/progress.html', label: 'Progress', hasReactIsland: true },
  { path: '/select.html', label: 'Select', hasReactIsland: true },
  { path: '/menu.html', label: 'Menu', hasReactIsland: true },
  { path: '/combobox.html', label: 'Combobox', hasReactIsland: true },
  { path: '/pin-input.html', label: 'PinInput', hasReactIsland: true },
  { path: '/tags-input.html', label: 'TagsInput', hasReactIsland: true },
] as const;

test.use({ reducedMotion: 'reduce' });

type Theme = 'light' | 'dark';
async function openFixture(page: Page, path: string, theme: Theme, contrast = 'more') {
  await page.goto(path);
  const reactRoot = page.locator('#react-root');
  if (await reactRoot.count()) await expect(reactRoot).not.toBeEmpty();
  await page.evaluate(
    ({ theme, contrast }) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.contrast = contrast;
    },
    { theme, contrast },
  );
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page
        .locator('html')
        .evaluate((element) =>
          getComputedStyle(element).getPropertyValue('--_lab-contrast-mode').trim(),
        ),
    )
    .toBe(contrast);
  await page.mouse.move(0, 0);
  // Anatomy использует готовый CSS без runtime owner.
  if (path !== '/_fixtures/button-anatomy.html') await waitForThemePaint(page);
}

for (const theme of ['light', 'dark'] as const) {
  for (const { path, label } of COMPONENT_FIXTURES) {
    test(`axe AA more ${theme} · ${label}`, async ({ page }) => {
      await openFixture(page, path, theme);
      await assertAxeAA(page);
    });
  }

  for (const renderer of ['lit', 'react'] as const) {
    for (const variant of ['accent-fill', 'neutral-tinted'] as const) {
      test(`AA more ${theme} · ${renderer} Button ${variant}: label over surface`, async ({
        page,
      }) => {
        await openFixture(page, '/button.html', theme);
        const host = page.getByTestId(`${renderer}-${variant}`);
        const button = renderer === 'lit' ? host.locator('button') : host;
        await expect(button).toBeVisible();
        await assertLabelContrast(button, button);
      });
    }
    test(`AA more ${theme} · ${renderer} Input: label over surface`, async ({ page }) => {
      await openFixture(page, '/input.html', theme);
      const input = page.getByTestId(`${renderer}-neutral`).locator('input');
      await expect(input).toBeVisible();
      await assertLabelContrast(input, input);
    });

    test(`normal ${theme} · ${renderer}: authored accent and translucent description survive more`, async ({
      page,
    }) => {
      await openFixture(page, '/_fixtures/button-anatomy.html', theme, 'normal');
      const host = page.getByTestId(`${renderer}-anatomy-m-full`);
      const button = renderer === 'lit' ? host.locator('button') : host;
      const description = host.getByText('Description', { exact: true });
      const normalFill = theme === 'light' ? 'rgb(0, 122, 255)' : 'rgb(74, 143, 255)';
      await expect(button).toHaveCSS('background-color', normalFill);
      // CSSOM сериализует .722 как .72, поэтому независимый CSS-color oracle живёт в браузере.
      const normalDescription = await page.evaluate(() => {
        const reference = document.createElement('span');
        reference.hidden = true;
        reference.style.color = 'rgb(255 255 255 / .722)';
        document.body.append(reference);
        const color = getComputedStyle(reference).color;
        reference.remove();
        return color;
      });
      await expect(description).toHaveCSS('color', normalDescription);
      await page
        .locator('html')
        .evaluate((element) => element.setAttribute('data-contrast', 'more'));
      await expect(description).toHaveCSS('color', 'rgb(255, 255, 255)');
      await assertLabelContrast(description, button);
      await page
        .locator('html')
        .evaluate((element) => element.setAttribute('data-contrast', 'normal'));
      await expect(button).toHaveCSS('background-color', normalFill);
      await expect(description).toHaveCSS('color', normalDescription);
    });
  }
}

test('contrast oracle composites translucent foreground before evaluating AA', async ({ page }) => {
  await page.setContent(
    '<div id="surface" style="background:white"><span id="label" style="color:black">Readable</span></div>',
  );
  const label = page.locator('#label');
  const surface = page.locator('#surface');
  expect((await assertLabelContrast(label, surface)).ratio).toBe(21);
  await label.evaluate((element) => {
    (element as HTMLElement).style.color = 'rgb(0 0 0 / .1)';
  });
  await expect(assertLabelContrast(label, surface)).rejects.toThrow('Контраст лейбл/поверхность');
  await label.evaluate((element) => {
    (element as HTMLElement).style.color = 'black';
  });
  expect((await assertLabelContrast(label, surface)).ratio).toBe(21);
});
