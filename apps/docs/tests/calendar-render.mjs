import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect } from '@playwright/test';

const output = new URL('../../../docs/evidence/calendar-20261123/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1248, height: 1200 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const records = [];
try {
  for (const theme of ['light', 'dark'])
    for (const size of ['s', 'm'])
      for (const state of ['single', 'range', 'disabled']) {
        await page.goto(
          `${process.env.PW_BASE_URL ?? 'http://127.0.0.1:4427'}/_fixtures/calendar.html`,
        );
        await page.locator('#react-form .lab-calendar-day').first().waitFor();
        await page.evaluate(
          ({ theme, size, state }) => {
            document.documentElement.dataset.theme = theme;
            window.calendarFixture.set({
              size,
              selection: state === 'range' ? 'range' : 'single',
              value: state === 'range' ? ['2024-05-13', '2024-05-17'] : ['2024-05-15'],
              markers: ['2024-05-14', '2024-05-23'],
              disabled: state === 'disabled',
              events: {
                '2024-05-13': 1,
                '2024-05-14': 2,
                '2024-05-15': 7,
                '2024-05-16': 4,
                '2024-05-17': 5,
                '2024-05-23': 3,
              },
            });
          },
          { theme, size, state },
        );
        await page.evaluate(() => document.fonts.ready);
        for (const renderer of ['lit', 'react']) {
          const scope = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
          const surface = scope.locator('[data-lab-calendar]');
          await expect(surface).toHaveAttribute('data-size', size);
          await surface.screenshot({
            path: fileURLToPath(new URL(`${renderer}-${theme}-${size}-${state}.png`, output)),
          });
          records.push(
            await surface.evaluate(
              (element, detail) => {
                const rect = element.getBoundingClientRect();
                const grid = element.querySelector('.lab-calendar-grid').getBoundingClientRect();
                const title = getComputedStyle(element.querySelector('.lab-calendar-title'));
                const day = getComputedStyle(element.querySelector('.lab-calendar-day'));
                return {
                  ...detail,
                  width: rect.width,
                  height: rect.height,
                  grid: [grid.width, grid.height],
                  title: [title.fontSize, title.lineHeight, title.fontWeight, title.letterSpacing],
                  day: [day.fontSize, day.lineHeight, day.fontWeight],
                  days: element.querySelectorAll('.lab-calendar-day').length,
                };
              },
              { renderer, theme, size, state },
            ),
          );
        }
      }
  await page.evaluate(() =>
    window.calendarFixture.set({ disabled: false, selection: 'single', value: ['2024-05-15'] }),
  );
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);
  for (const renderer of ['lit', 'react']) {
    const scope = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    await scope.locator('[data-date="2024-05-16"]').hover();
    await scope.locator('[data-date="2024-05-15"]').focus();
    await scope
      .locator('[data-lab-calendar]')
      .screenshot({ path: fileURLToPath(new URL(`${renderer}-dark-m-focus-hover.png`, output)) });
  }
  for (const size of ['s', 'm'])
    for (const direction of ['ltr', 'rtl']) {
      await page.evaluate(
        ({ size, direction }) => {
          document.documentElement.dir = direction;
          window.calendarFixture.set({
            size,
            selection: 'range',
            value: ['2024-05-13', '2024-05-17'],
          });
        },
        { size, direction },
      );
      for (const renderer of ['lit', 'react']) {
        const scope = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
        for (const [edge, day] of [
          ['start', '13'],
          ['middle', '15'],
          ['end', '17'],
        ]) {
          await scope.locator(`[data-date="2024-05-${day}"]`).focus();
          await scope.locator('[data-lab-calendar]').screenshot({
            path: fileURLToPath(
              new URL(`${renderer}-dark-${size}-range-focus-${direction}-${edge}.png`, output),
            ),
          });
        }
      }
    }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.style.fontSize = '32px';
    window.calendarFixture.set({ locale: 'ru-RU', selection: 'single', value: ['2024-05-15'] });
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const renderer of ['lit', 'react']) {
    const scope = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    expect(
      await scope.locator('.lab-calendar-title').evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await scope.locator('[data-date="2024-05-18"]').focus();
    await scope
      .locator('[data-lab-calendar]')
      .screenshot({ path: fileURLToPath(new URL(`${renderer}-dark-m-narrow-200.png`, output)) });
  }
  await page.emulateMedia({ forcedColors: 'active' });
  const buttonText = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'ButtonText';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  for (const renderer of ['lit', 'react']) {
    const scope = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    const glyph = await scope
      .locator('.lab-calendar-chevron')
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          background: style.backgroundColor,
          ink: style.color,
          adjustment: style.forcedColorAdjust,
        };
      });
    expect(glyph.background).toBe(glyph.ink);
    expect(glyph.ink).toBe(buttonText);
    expect(glyph.adjustment).toBe('none');
  }
  await page.screenshot({
    path: fileURLToPath(new URL('forced-colors-narrow-200.png', output)),
    fullPage: true,
  });
  await writeFile(
    new URL('render.generated.json', output),
    `${JSON.stringify({ records, axe: { violations: accessibility.violations }, rangeFocus: 'S/M × LTR/RTL × start/middle/end × Lit/React', narrow200: 'full month, internal 2D scroll, no document overflow', forcedColors: true }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
