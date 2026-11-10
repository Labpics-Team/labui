import { type Locator, type Page, expect, test } from '@playwright/test';

async function expectColor(locator: Locator, property: string, color: string) {
  const expected = await locator.evaluate((_, color) => {
    // Браузер нормализует независимое исходное RGBA; продуктовые роли не читаются.
    const reference = document.createElement('span');
    reference.hidden = true;
    reference.style.setProperty('color', color, 'important');
    document.body.append(reference);
    const normalized = getComputedStyle(reference).color;
    reference.remove();
    return normalized;
  }, color);
  await expect(locator).toHaveCSS(property, expected);
}

test.beforeEach(async ({ browser }, testInfo) => {
  testInfo.annotations.push({ type: 'browser', description: browser.version() });
});

const themes = [
  { root: 'light', nested: null },
  { root: 'dark', nested: null },
  { root: 'light', nested: 'dark' },
  { root: 'dark', nested: 'light' },
  { root: 'system', nested: null },
] as const;

async function setTheme(page: Page, root: string, nested: string | null = null) {
  await page.evaluate(
    ({ root, nested }) => {
      if (root === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', root);
      const scope = document.querySelector('main');
      if (!scope) throw new Error('Не найдена область настоящих компонентов');
      if (nested) scope.setAttribute('data-theme', nested);
      else scope.removeAttribute('data-theme');
    },
    { root, nested },
  );
  await expectColor(
    page.locator('body'),
    'color',
    root === 'light' ? 'rgb(16 16 18)' : 'rgb(246 248 250)',
  );
}

test('authored colors: existing Button slots preserve fixed white and alpha through theme scopes', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', contrast: 'no-preference' });
  await page.goto('/button.html');
  await expect(page.locator('html')).toHaveAttribute('data-lab-colors-state', 'ready');
  for (const renderer of ['lit', 'react']) {
    const host = page.getByTestId(`${renderer}-accent-fill`);
    await expect(host).toBeVisible();
    // Существующий публичный default slot принимает авторскую Paint без новой anatomy API.
    await host.evaluate((element, renderer) => {
      const secondary = document.createElement('span');
      secondary.dataset.testid = `${renderer}-authored-secondary`;
      secondary.style.color = 'var(--lab-label-static-light-secondary)';
      secondary.textContent = 'Secondary paint';
      element.append(secondary);
    }, renderer);
  }
  const observations = [];
  for (const { root, nested } of themes) {
    await setTheme(page, root, nested);
    for (const renderer of ['lit', 'react']) {
      const host = page.getByTestId(`${renderer}-accent-fill`);
      const label = renderer === 'lit' ? host.locator('button') : host;
      const secondary = host.getByTestId(`${renderer}-authored-secondary`);
      await expect(secondary).toBeVisible();
      // Независимое исходное RGBA из неизменного figma-reference.css.
      await expectColor(label, 'color', 'rgb(255 255 255)');
      await expectColor(secondary, 'color', 'rgb(255 255 255 / 0.722)');
      observations.push({
        renderer,
        root,
        nested,
        color: await secondary.evaluate((element) => getComputedStyle(element).color),
      });
    }
  }
  await testInfo.attach('button-authored-paints', {
    body: JSON.stringify(observations, null, 2),
    contentType: 'application/json',
  });
});

test('authored colors: Dialog scrim consumes the page theme at its portal root', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const observations = [];
  // Тема страницы устанавливается до создания Core portal и его shadow root.
  await page.addInitScript(() => {
    const theme = new URL(location.href).searchParams.get('theme');
    if (!theme) return;
    const apply = () => {
      const html = document.documentElement;
      if (!html) return false;
      if (theme === 'system') html.removeAttribute('data-theme');
      else html.setAttribute('data-theme', theme);
      return true;
    };
    if (apply()) return;
    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect();
    });
    observer.observe(document, { childList: true });
  });
  for (const root of ['light', 'dark', 'system']) {
    for (const renderer of ['lit', 'react']) {
      await page.goto(`/dialog.html?theme=${root}`);
      await setTheme(page, root);
      const host = page.getByTestId(`${renderer}-dialog`);
      await host.locator(renderer === 'lit' ? '.trigger' : '.lab-dialog-trigger').click();
      const scrim =
        renderer === 'lit'
          ? page.locator('[data-portal-for="lit-dialog"]').locator('.backdrop')
          : page.locator('.lab-dialog-backdrop');
      await expect(scrim).toBeVisible();
      const expected = root === 'light' ? 'rgb(255 255 255 / 0.478)' : 'rgb(16 16 18 / 0.478)';
      await expectColor(scrim, 'background-color', expected);
      observations.push({
        renderer,
        root,
        background: await scrim.evaluate((element) => getComputedStyle(element).backgroundColor),
      });
    }
  }
  await testInfo.attach('dialog-scrim-colors', {
    body: JSON.stringify(observations, null, 2),
    contentType: 'application/json',
  });
});

test('authored colors: selection retains semantic bindings and nested inheritance', async ({
  page,
}, testInfo) => {
  await page.goto('/button.html');
  await expect(page.locator('html')).toHaveAttribute('data-lab-colors-state', 'ready');
  const observations = [];
  for (const { root, nested } of themes.filter((theme) => theme.root !== 'system')) {
    await setTheme(page, root, nested);
    const observation = await page.getByTestId('lit-renderer').locator('h2').evaluate((element) => {
      const scope = element.closest('[data-theme]') as HTMLElement;
      if (!scope) throw new Error('Выделение требует явной области LabUI');
      const before = getComputedStyle(element, '::selection');
      const original = { color: before.color, background: before.backgroundColor };
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      // Меняется публичная роль на настоящем потребителе, не его ::selection правило.
      scope.style.setProperty('--lab-fill-accent', 'rgb(11 22 33)', 'important');
      scope.style.setProperty('--lab-label-on-accent', 'rgb(240 241 242)', 'important');
      const changed = getComputedStyle(element, '::selection');
      const result = {
        original,
        selected: selection?.toString(),
        color: changed.color,
        background: changed.backgroundColor,
      };
      scope.style.removeProperty('--lab-fill-accent');
      scope.style.removeProperty('--lab-label-on-accent');
      selection?.removeAllRanges();
      const restored = getComputedStyle(element, '::selection');
      return {
        ...result,
        restored: { color: restored.color, background: restored.backgroundColor },
      };
    });
    expect(observation.selected).toBe('Lit');
    expect(observation.color).toBe('rgb(240, 241, 242)');
    expect(observation.background).toBe('rgb(11, 22, 33)');
    expect(observation.restored).toEqual(observation.original);
    observations.push({ root, nested, ...observation });
  }
  expect(observations).toHaveLength(4);
  expect(observations.at(0)?.original).toEqual(observations.at(3)?.original);
  expect(observations.at(1)?.original).toEqual(observations.at(2)?.original);
  expect(observations.at(0)?.original).not.toEqual(observations.at(1)?.original);
  await testInfo.attach('selection-colors', {
    body: JSON.stringify(observations, null, 2),
    contentType: 'application/json',
  });
});
