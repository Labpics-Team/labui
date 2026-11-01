import { readFileSync } from 'node:fs';
import { type Locator, type Page, type TestInfo, expect, test } from '@playwright/test';
import { decodePng } from '../../../packages/colors/test/fx-render/fx-render.mjs';

type Rgb = [number, number, number];
type Renderer = 'lit' | 'react';
type Theme = 'light' | 'dark';
type State = 'default' | 'hover' | 'pressed';
type Png = ReturnType<typeof decodePng>;

test.use({ deviceScaleFactor: 1 });

function contrast(a: Rgb, b: Rgb) {
  const luminance = (rgb: Rgb) => {
    const linear = rgb.map((value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as Rgb;
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function pixel(png: Png, x: number, y: number): Rgb {
  const at = (Math.floor(y) * png.width + Math.floor(x)) * 3;
  return Array.from(png.rgb.subarray(at, at + 3)) as Rgb;
}

function rgb(css: string): Rgb {
  const channels = css.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/);
  if (!channels) throw new Error(`Не rgb: ${css}`);
  return channels.slice(1, 4).map(Number) as Rgb;
}

async function setup(page: Page, path: string, theme: Theme) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await page.evaluate(async (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.contrast = 'more';
    document.documentElement.style.setProperty('--lab-motion-transition-duration', '0s');
    await document.fonts.ready;
  }, theme);
}

async function isolate(host: Locator, control: Locator) {
  await host.evaluate((element) => {
    document.body.style.visibility = 'hidden';
    const style = (element as HTMLElement).style;
    style.visibility = 'visible';
    style.position = 'fixed';
    style.left = '100px';
    style.top = '100px';
  });
  const box = await control.boundingBox();
  if (!box) throw new Error('Нет видимой области control');
  await host.evaluate((element, box) => {
    (element as HTMLElement).style.left = `${200 - box.x}px`;
    (element as HTMLElement).style.top = `${200 - box.y}px`;
  }, box);
  const aligned = await control.boundingBox();
  expect(aligned?.x).toBe(100);
  expect(aligned?.y).toBe(100);
}

async function state(page: Page, button: Locator, value: State) {
  await page.mouse.up();
  await page.mouse.move(0, 0);
  if (value !== 'default') await button.hover();
  if (value === 'pressed') await page.mouse.down();
}

/** Реальные цветовые прямоугольники наследуют currentColor исходных glyph.
 * CSSOM не сериализуется обратно в краску: это теряло alpha .722 → .72.
 * Прямоугольник заменяет только покрытие glyph, сохраняя его цвет и фон.
 */
async function buttonPaint(
  host: Locator,
  button: Locator,
  renderer: Renderer,
  info: TestInfo,
  name: string,
) {
  const box = await button.boundingBox();
  if (!box) throw new Error('Нет Button');
  const entries = [
    ['primary', host.locator('[data-label]')],
    ['secondary', host.getByText('Description', { exact: true })],
    ['start', host.locator('[data-glyph="start"]')],
    ['end', host.locator('[data-glyph="end"]')],
  ] as const;
  const regions = [];
  for (const [role, locator] of entries) {
    const rect = await locator.boundingBox();
    if (!rect) throw new Error(`Нет ${role}`);
    regions.push({
      role,
      x: rect.x - box.x,
      y: rect.y - box.y,
      width: rect.width,
      height: rect.height,
      css: await locator.evaluate((e) => getComputedStyle(e).color),
      weight: await locator.evaluate((e) => getComputedStyle(e).fontWeight),
    });
  }
  const full = decodePng(await button.screenshot({ path: info.outputPath(`${name}.png`) }));
  const content = button.locator(renderer === 'lit' ? '.content' : '.lab-button-content');
  await content.evaluate((e) => {
    (e as HTMLElement).style.opacity = '0';
  });
  const background = decodePng(
    await button.screenshot({ path: info.outputPath(`${name}-background.png`) }),
  );
  await content.evaluate((e) => {
    (e as HTMLElement).style.removeProperty('opacity');
  });
  for (const [, locator] of entries)
    await locator.evaluate((e) => {
      const element = e as HTMLElement | SVGElement;
      element.setAttribute('data-qa-style', element.getAttribute('style') ?? '');
      if (element instanceof SVGElement) {
        for (const child of element.children) {
          child.setAttribute('data-qa-style', child.getAttribute('style') ?? '');
          (child as SVGElement).style.visibility = 'hidden';
        }
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('data-qa-paint', '');
        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', 'currentColor');
        rect.style.visibility = 'visible';
        element.append(rect);
      } else {
        element.style.visibility = 'hidden';
        const box = element.getBoundingClientRect();
        const paint = document.createElement('span');
        paint.setAttribute('data-qa-paint', '');
        paint.style.cssText = `position:fixed;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;background:currentColor;visibility:visible;pointer-events:none`;
        element.append(paint);
      }
    });
  let ideal: Png;
  try {
    ideal = decodePng(await button.screenshot({ path: info.outputPath(`${name}-color.png`) }));
  } finally {
    for (const [, locator] of entries)
      await locator.evaluate((e) => {
        e.querySelector('[data-qa-paint]')?.remove();
        for (const child of e.querySelectorAll('[data-qa-style]')) {
          child.setAttribute('style', child.getAttribute('data-qa-style') ?? '');
          child.removeAttribute('data-qa-style');
        }
        e.setAttribute('style', e.getAttribute('data-qa-style') ?? '');
        e.removeAttribute('data-qa-style');
      });
  }
  const measurements = regions.map((region) => {
    let minimum = Number.POSITIVE_INFINITY;
    let occupied = 0;
    let minimumPixel: { x: number; y: number; foreground: Rgb; background: Rgb } | undefined;
    for (
      let y = Math.max(0, Math.ceil(region.y));
      y < Math.min(full.height, Math.floor(region.y + region.height));
      y++
    ) {
      for (
        let x = Math.max(0, Math.ceil(region.x));
        x < Math.min(full.width, Math.floor(region.x + region.width));
        x++
      ) {
        const original = pixel(full, x, y);
        const bg = pixel(background, x, y);
        if (!([0, 1, 2] as const).some((i) => Math.abs(original[i] - bg[i]) > 4)) continue;
        occupied++;
        const foreground = pixel(ideal, x, y);
        const ratio = contrast(foreground, bg);
        if (ratio < minimum) {
          minimum = ratio;
          minimumPixel = { x, y, foreground, background: bg };
        }
      }
    }
    expect(occupied, `${name}/${region.role}: непустой glyph`).toBeGreaterThan(0);
    return { ...region, occupied, minimum, minimumPixel };
  });
  return { full, background, measurements, box };
}

for (const renderer of ['lit', 'react'] as const)
  for (const theme of ['light', 'dark'] as const) {
    for (const size of ['s', 'm', 'l'] as const) {
      test(`IC Button ${renderer} ${theme} ${size}: текст и состояния`, async ({ page }, info) => {
        // Каждый размер получает свежий document; fixed-host предыдущего случая отсутствует.
        await setup(page, '/_fixtures/button-anatomy.html', theme);
        const host = page.getByTestId(`${renderer}-anatomy-${size}-full`);
        const button = renderer === 'lit' ? host.locator('button') : host;
        await isolate(host, button);
        const results = [];
        let baseline: Png | undefined;
        for (const current of ['default', 'hover', 'pressed'] as const) {
          await state(page, button, current);
          const result = await buttonPaint(host, button, renderer, info, current);
          results.push({ state: current, measurements: result.measurements, box: result.box });
          expect(result.box.height).toBe({ s: 36, m: 48, l: 56 }[size]);
          const primary = result.measurements.find((item) => item.role === 'primary');
          const secondary = result.measurements.find((item) => item.role === 'secondary');
          expect(Number(primary?.weight)).toBeGreaterThan(Number(secondary?.weight));
          for (const item of result.measurements) {
            expect.soft(rgb(item.css), `${item.role}: white polarity`).toEqual([255, 255, 255]);
            expect
              .soft(item.minimum, `${current}/${item.role}`)
              .toBeGreaterThanOrEqual(item.role === 'start' || item.role === 'end' ? 3 : 4.5);
          }
          if (current === 'default') baseline = result.background;
          else
            expect(
              result.background.rgb.every((value, index) => value === baseline?.rgb[index]),
              `Видимое ${current}`,
            ).toBe(false);
        }
        await page.mouse.up();
        await info.attach('measurements', {
          body: JSON.stringify(results, null, 2),
          contentType: 'application/json',
        });
        await page.keyboard.press('Tab');
        await button.focus();
        const focus = await button.evaluate((e) => ({
          style: getComputedStyle(e).outlineStyle,
          width: getComputedStyle(e).outlineWidth,
          color: getComputedStyle(e).outlineColor,
          bg: getComputedStyle(document.body).backgroundColor,
        }));
        expect(focus.style).toBe('solid');
        expect(Number.parseFloat(focus.width)).toBeGreaterThan(0);
        expect(contrast(rgb(focus.color), rgb(focus.bg))).toBeGreaterThanOrEqual(3);
      });
    }
  }

const contract = readFileSync(
  new URL('../../../packages/colors/contract.css', import.meta.url),
  'utf8',
);
const themeCss = readFileSync(
  new URL('../../../packages/core/src/theme.css', import.meta.url),
  'utf8',
);
const roleGroups = JSON.parse(
  readFileSync(new URL('../../../packages/colors/roles.json', import.meta.url), 'utf8'),
).groups as Record<string, string[]>;
const colorRoles = Object.values(roleGroups).flat();
const scopeHtml = `<i id="a"></i><section data-theme="dark"><i id="b"></i><section data-contrast="more"><i id="c"></i><section data-theme="light"><i id="d"></i><section data-contrast="normal"><i id="e"></i><section data-theme="dark"><i id="f"></i><section data-contrast="auto"><i id="g"></i><section data-theme="auto"><i id="h"></i></section></section></section></section></section></section></section>`;
const accent = {
  light: { normal: [0, 122, 255], more: [0, 64, 221] },
  dark: { normal: [74, 143, 255], more: [64, 156, 255] },
};

for (const osTheme of ['light', 'dark'] as const)
  for (const osContrast of ['no-preference', 'more'] as const) {
    test(`CSS без JS: ${osTheme}/${osContrast}, независимые вложенные области`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        colorScheme: osTheme,
        contrast: osContrast,
      });
      try {
        const page = await context.newPage();
        await page.setContent(
          `<style>${contract}\n${themeCss}\ni {color:var(--lab-label-accent)}</style>${scopeHtml}`,
        );
        const ordinary = osContrast === 'more' ? 'more' : 'normal';
        const expected = [
          [osTheme, ordinary],
          ['dark', ordinary],
          ['dark', 'more'],
          ['light', 'more'],
          ['light', 'normal'],
          ['dark', 'normal'],
          ['dark', ordinary],
          [osTheme, ordinary],
        ] as const;
        for (const [index, id] of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].entries()) {
          const actual = await page.locator(`#${id}`).evaluate((e) => ({
            color: getComputedStyle(e).color,
            raw: getComputedStyle(e).getPropertyValue('--lab-label-accent'),
          }));
          const pair = expected[index];
          if (!pair) throw new Error(`Нет ожидаемой области ${index}`);
          const [theme, mode] = pair;
          expect(rgb(actual.color), id).toEqual(accent[theme][mode]);
          expect(actual.raw.trim(), `${id}: разрешённый raw color`).toMatch(/^rgb\(/);
          const invalid = await page.locator(`#${id}`).evaluate((e, names) => {
            const styles = getComputedStyle(e);
            return names.filter(
              (name) => !CSS.supports('color', styles.getPropertyValue(name).trim()),
            );
          }, colorRoles);
          expect(invalid, `${id}: все контрактные краски разрешены`).toEqual([]);
        }
      } finally {
        await context.close();
      }
    });
  }

for (const renderer of ['lit', 'react'] as const)
  test(`Смена ближайшей области на смонтированной Button ${renderer}`, async ({ page }) => {
    await setup(page, '/_fixtures/button-anatomy.html', 'dark');
    const host = page.getByTestId(`${renderer}-anatomy-m-full`);
    const button = renderer === 'lit' ? host.locator('button') : host;
    await host.evaluate((e) => {
      const scope = document.createElement('section');
      scope.id = 'local-contrast';
      scope.dataset.contrast = 'normal';
      e.parentElement?.insertBefore(scope, e);
      scope.append(e);
    });
    await expect(button).toHaveCSS('background-color', 'rgb(74, 143, 255)');
    await page.locator('#local-contrast').evaluate((e) => e.setAttribute('data-theme', 'light'));
    await expect(button).toHaveCSS('background-color', 'rgb(0, 122, 255)');
    await page.locator('#local-contrast').evaluate((e) => e.setAttribute('data-contrast', 'more'));
    await expect(button).toHaveCSS('background-color', 'rgb(0, 64, 221)');
    await page.locator('#local-contrast').evaluate((e) => e.removeAttribute('data-theme'));
    const changed = await button.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(rgb(changed)).not.toEqual([0, 64, 221]);
    await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
    await page
      .locator('#local-contrast')
      .evaluate((e) => e.setAttribute('data-contrast', 'normal'));
    await expect(button).toHaveCSS('background-color', 'rgb(74, 143, 255)');
  });

test('forced-colors не подменяет явный выбор normal', async ({ page }, info) => {
  await page.emulateMedia({ forcedColors: 'active', contrast: 'more' });
  await page.setContent(
    `<style>${contract}\n${themeCss}\nbutton{color:var(--lab-label-on-accent);background:var(--lab-fill-accent)}</style><div data-contrast="normal"><button>Action</button><span id="system" style="color:ButtonText;background:ButtonFace">Reference</span></div>`,
  );
  const values = await page.evaluate(() =>
    ['button', '#system'].map((selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(selector);
      const style = getComputedStyle(element);
      return {
        color: style.color,
        background: style.backgroundColor,
        adjustment: style.forcedColorAdjust,
        adjustmentSupported: CSS.supports('forced-color-adjust', 'auto'),
        accent: style.getPropertyValue('--lab-label-accent').trim(),
      };
    }),
  );
  if (values[0]?.adjustmentSupported) expect(values[0]?.adjustment).toBe('auto');
  expect(rgb(values[0]?.accent ?? '')).toEqual([0, 122, 255]);
  // Эмуляция WebKit не воспроизводит системную перекраску Chromium.
  // Здесь проверяется граница авторского режима; OS-palette остаётся readback.
  await info.attach('forced-colors-platform', {
    body: JSON.stringify(values, null, 2),
    contentType: 'application/json',
  });
});

for (const renderer of ['lit', 'react'] as const)
  for (const theme of ['light', 'dark'] as const) {
    test(`IC Checkbox ${renderer} ${theme}: unchecked, checked, mixed, focus`, async ({
      page,
    }, info) => {
      await setup(page, '/checkbox.html', theme);
      const report = [];
      for (const value of ['unchecked', 'checked', 'mixed']) {
        const host = page.getByTestId(`${renderer}-${value}`);
        const control = host.locator(renderer === 'lit' ? '.control' : '.lab-checkbox-control');
        await expect(control).toBeVisible();
        const paints = await control.evaluate((e) => {
          const s = getComputedStyle(e);
          return {
            border: s.borderColor,
            fill: s.backgroundColor,
            ink: s.color,
            bg: getComputedStyle(document.body).backgroundColor,
          };
        });
        expect(
          contrast(rgb(paints.border), rgb(paints.bg)),
          `${value}: граница`,
        ).toBeGreaterThanOrEqual(3);
        if (value !== 'unchecked') {
          const glyph = control.locator(
            renderer === 'lit'
              ? value === 'mixed'
                ? '.glyph-mixed'
                : '.glyph-check'
              : value === 'mixed'
                ? '.lab-checkbox-glyph-mixed'
                : '.lab-checkbox-glyph-check',
          );
          await expect(glyph).toBeVisible();
          expect(
            contrast(rgb(paints.ink), rgb(paints.fill)),
            `${value}: glyph`,
          ).toBeGreaterThanOrEqual(3);
        }
        await page.keyboard.press('Tab');
        await host.locator('input').focus();
        const focus = await control.evaluate((e) => ({
          color: getComputedStyle(e).outlineColor,
          style: getComputedStyle(e).outlineStyle,
          inputFocused: e.parentElement?.querySelector('input')?.matches(':focus'),
          inputFocusVisible: e.parentElement?.querySelector('input')?.matches(':focus-visible'),
          rootMatches: e.parentElement?.matches(':has(input:focus-visible)'),
        }));
        await info.attach(`${value}-focus`, {
          body: JSON.stringify(focus, null, 2),
          contentType: 'application/json',
        });
        expect(focus.style).toBe('solid');
        expect(contrast(rgb(focus.color), rgb(paints.bg))).toBeGreaterThanOrEqual(3);
        await host.locator('input').blur();
        await expect(control).toHaveCSS('outline-style', 'none');
        report.push({ value, paints, focus });
        await host.screenshot({ path: info.outputPath(`${value}.png`) });
      }
      await info.attach('cues', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json',
      });
    });

    test(`IC Switch ${renderer} ${theme}: дорожка, положение и focus`, async ({ page }, info) => {
      await setup(page, '/switch.html', theme);
      const report = [];
      const positions = [];
      for (const value of ['off', 'on']) {
        const host = page.getByTestId(`${renderer}-accent-${value}`);
        const track = host.locator(renderer === 'lit' ? '.control' : '.lab-switch-control');
        const thumb = host.locator(renderer === 'lit' ? '.thumb' : '.lab-switch-thumb');
        const paints = await track.evaluate((e) => {
          const s = getComputedStyle(e);
          return {
            fill: s.backgroundColor,
            outline: s.outlineColor,
            width: s.outlineWidth,
            bg: getComputedStyle(document.body).backgroundColor,
          };
        });
        const knob = await thumb.evaluate((e) => {
          const s = getComputedStyle(e);
          return { fill: s.backgroundColor, outline: s.outlineColor, width: s.outlineWidth };
        });
        expect(Number.parseFloat(paints.width)).toBeGreaterThan(0);
        expect(
          contrast(rgb(paints.outline), rgb(paints.bg)),
          `${value}: дорожка`,
        ).toBeGreaterThanOrEqual(3);
        expect(
          Math.max(
            contrast(rgb(knob.fill), rgb(paints.fill)),
            Number.parseFloat(knob.width) > 0 ? contrast(rgb(knob.outline), rgb(paints.fill)) : 0,
          ),
          `${value}: бегунок`,
        ).toBeGreaterThanOrEqual(3);
        const t = await track.boundingBox();
        const k = await thumb.boundingBox();
        if (!t || !k) throw new Error('Нет геометрии Switch');
        positions.push(k.x - t.x);
        await page.keyboard.press('Tab');
        await host.locator('input').focus();
        const focus = await track.evaluate((e) => ({
          color: getComputedStyle(e).outlineColor,
          style: getComputedStyle(e).outlineStyle,
        }));
        expect(focus.style).toBe('solid');
        expect(contrast(rgb(focus.color), rgb(paints.bg))).toBeGreaterThanOrEqual(3);
        report.push({ value, paints, knob, focus });
        await host.screenshot({ path: info.outputPath(`${value}.png`) });
      }
      const [off, on] = positions;
      if (off === undefined || on === undefined) throw new Error('Нет двух положений Switch');
      expect(on).toBeGreaterThan(off);
      await info.attach('cues', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json',
      });
    });
  }

test('порча secondary обнаруживается реальным цветовым paint', async ({ page }, info) => {
  await setup(page, '/_fixtures/button-anatomy.html', 'dark');
  const host = page.getByTestId('lit-anatomy-m-full');
  const button = host.locator('button');
  await isolate(host, button);
  const healthy = await buttonPaint(host, button, 'lit', info, 'healthy');
  expect(healthy.measurements.find((x) => x.role === 'secondary')?.minimum).toBeGreaterThanOrEqual(
    4.5,
  );
  await host.evaluate((e) =>
    (e as HTMLElement).style.setProperty(
      '--lab-label-static-light-secondary',
      'rgb(255 255 255 / .2)',
    ),
  );
  const mutant = await buttonPaint(host, button, 'lit', info, 'mutant');
  expect(mutant.measurements.find((x) => x.role === 'secondary')?.minimum).toBeLessThan(4.5);
});

async function materialPaint(panel: Locator) {
  return panel.evaluate((e) => {
    const style = getComputedStyle(e);
    const prefixed = style as CSSStyleDeclaration & { webkitBackdropFilter?: string };
    const inline = (e as HTMLElement).style;
    return {
      filter:
        [style.backdropFilter, prefixed.webkitBackdropFilter].find(
          (value) => value && value !== 'none',
        ) ?? 'none',
      inline:
        inline.getPropertyValue('backdrop-filter') ||
        inline.getPropertyValue('-webkit-backdrop-filter'),
      base: style.getPropertyValue('--_base').trim(),
      paint: style.getPropertyValue('--_base-paint').trim(),
      noise: style.getPropertyValue('--_noise').trim(),
      rim: style.getPropertyValue('--_rim').trim(),
      image: style.backgroundImage,
    };
  });
}

for (const runtime of [false, true])
  test(`Материалы: local normal/more, OS и forced-colors; runtime=${runtime}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ contrast: 'more' });
    await page.goto('/_fixtures/acrylic-live.html');
    await expect(page.getByTestId('live-status')).toHaveText('runtime: mounted');
    if (!runtime) await page.evaluate(() => window.__labAcrylicLive?.dispose());
    const panel = page.getByTestId('surface-on-black');
    const inherited = page.getByTestId('surface-on-white');
    await panel.evaluate((e) => e.setAttribute('data-contrast', 'normal'));
    await expect.poll(async () => (await materialPaint(panel)).filter).not.toBe('none');
    await expect.poll(async () => (await materialPaint(inherited)).filter).toBe('none');
    const normal = await materialPaint(panel);
    expect(normal.noise).not.toBe('none');
    expect(normal.rim).not.toBe('none');
    await panel.evaluate((e) => e.setAttribute('data-contrast', 'more'));
    await expect.poll(async () => (await materialPaint(panel)).filter).toBe('none');
    const more = await materialPaint(panel);
    expect(more.inline).toBe('');
    expect(more.paint).toBe(more.base);
    expect(more.noise).toBe('none');
    expect(more.rim).toBe('none');
    await page.emulateMedia({ contrast: 'no-preference' });
    await expect.poll(async () => (await materialPaint(inherited)).filter).not.toBe('none');
    await expect.poll(async () => (await materialPaint(panel)).filter).toBe('none');
    await panel.evaluate((e) => e.setAttribute('data-contrast', 'normal'));
    await expect.poll(async () => (await materialPaint(panel)).filter).not.toBe('none');
    await page.emulateMedia({ forcedColors: 'active' });
    const forcedSupported = await page.evaluate(
      () => matchMedia('(forced-colors: active)').matches,
    );
    if (forcedSupported) {
      await expect.poll(async () => (await materialPaint(panel)).filter).toBe('none');
      const forced = await materialPaint(panel);
      expect(forced.inline).toBe('');
      expect(forced.image).toBe('none');
    }
    await info.attach('material-scopes', {
      body: JSON.stringify(
        { normal, more, forcedSupported, forced: await materialPaint(panel) },
        null,
        2,
      ),
      contentType: 'application/json',
    });
  });
