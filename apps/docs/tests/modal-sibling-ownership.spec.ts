import { expect, test } from '@playwright/test';

const specimens = [
  {
    kind: 'select',
    lit: 'lit-select',
    react: 'react-select',
    litControl: '.trigger',
    reactControl: '.lab-select-trigger',
  },
  {
    kind: 'menu',
    lit: 'lit-menu',
    react: 'react-menu',
    litControl: '.trigger',
    reactControl: '.lab-menu-trigger',
  },
  {
    kind: 'combobox',
    lit: 'lit-combobox',
    react: 'react-combobox',
    litControl: '.input',
    reactControl: '.lab-combobox-input',
  },
  {
    kind: 'popover',
    lit: 'lit-pop',
    react: 'react-pop',
    litControl: '.trigger',
    reactControl: '.lab-popover-trigger',
  },
] as const;

for (const pointer of ['mouse', 'touch'] as const) {
  test.describe(pointer, () => {
    if (pointer === 'touch') test.use({ hasTouch: true });
    for (const specimen of specimens) {
      for (const order of ['lit-react', 'react-lit'] as const) {
        test(`${specimen.kind} ${order}: новый sibling сохраняется после позднего outside старого`, async ({
          page,
        }, testInfo) => {
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.goto(`/${specimen.kind}.html`);
          const lit = page.getByTestId(specimen.lit).locator(specimen.litControl);
          const react = page.getByTestId(specimen.react).locator(specimen.reactControl);
          const first = order === 'lit-react' ? lit : react;
          const second = order === 'lit-react' ? react : lit;
          const press = async (control: typeof lit) => {
            if (pointer === 'touch') await control.tap();
            else await control.click();
          };
          await press(first);
          await expect(first).toHaveAttribute('aria-expanded', 'true');
          await press(second);
          await expect(first).toHaveAttribute('aria-expanded', 'false');
          await expect(second).toHaveAttribute('aria-expanded', 'true');
          // Два кадра дают завершиться существующему deferred outside и cleanup.
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              ),
          );
          await expect(second).toHaveAttribute('aria-expanded', 'true');
          await page.keyboard.press('Escape');
          await expect(second).toHaveAttribute('aria-expanded', 'false');
          await expect(first).toHaveAttribute('aria-expanded', 'false');
          expect(errors).toEqual([]);
          await testInfo.attach('sibling-transition.json', {
            body: JSON.stringify({ pointer, kind: specimen.kind, order, errors }, null, 2),
            contentType: 'application/json',
          });
        });
      }
    }
  });
}
