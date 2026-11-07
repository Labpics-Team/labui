import { readFileSync } from 'node:fs';
import { type Locator, type Page, type TestInfo, expect, test } from '@playwright/test';
import { decodePng } from '../../../packages/colors/test/fx-render/fx-render.mjs';

type Renderer = 'lit' | 'react' | 'vue';
type Theme = 'light' | 'dark';
type State = 'default' | 'hover' | 'pressed';
type Png = ReturnType<typeof decodePng>;
type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

test.use({ deviceScaleFactor: 1 });

// Независимый read-only источник: design-baseline.md, 1 ноября 2026.
// Paint samples вне glyph: x=center, y=4 и height-2 при root16.
const reference = {
  s: {
    height: 36,
    shift: -1,
    default: [
      [45, 145, 255],
      [3, 122, 250],
    ],
    hover: [
      [72, 160, 255],
      [4, 122, 250],
    ],
    pressed: [
      [44, 135, 234],
      [42, 144, 254],
    ],
  },
  m: {
    height: 48,
    shift: 0,
    default: [
      [46, 147, 255],
      [2, 121, 249],
    ],
    hover: [
      [75, 162, 255],
      [3, 121, 249],
    ],
    pressed: [
      [43, 134, 233],
      [41, 143, 254],
    ],
  },
  l: {
    height: 56,
    shift: 3,
    default: [
      [47, 147, 255],
      [2, 121, 252],
    ],
    hover: [
      [75, 162, 255],
      [2, 121, 252],
    ],
    pressed: [
      [41, 133, 232],
      [39, 142, 255],
    ],
  },
} as const;

function nativeButton(host: Locator, renderer: Renderer) {
  return renderer === 'react' ? host : host.locator('button');
}

function pixel(png: Png, x: number, y: number): Rgb {
  const at = (Math.floor(y) * png.width + Math.floor(x)) * 3;
  const value = Array.from(png.rgb.subarray(at, at + 3));
  if (value.length !== 3) throw new Error(`Пиксель (${x}, ${y}) вне PNG`);
  return value as Rgb;
}

async function setup(
  page: Page,
  theme: Theme,
  rootPx: number,
  authored: boolean,
  animated = false,
) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/_fixtures/button-anatomy.html');
  await page.evaluate(
    async ({ theme, rootPx, authored, animated }) => {
      const root = document.documentElement;
      if (!animated) root.style.setProperty('--lab-motion-transition-duration', '0s');
      root.setAttribute('data-theme', theme);
      root.style.fontSize = `${rootPx}px`;
      if (authored) {
        root.style.setProperty(
          '--lab-fill-accent',
          theme === 'light' ? 'rgb(0 122 255)' : 'rgb(74 143 255)',
        );
        root.style.setProperty('--lab-label-on-accent', 'white');
        root.style.setProperty('--lab-bg-static-light', 'white');
        root.style.setProperty('--lab-bg-static-dark', 'rgb(16 16 18)');
      }
      await document.fonts.ready;
    },
    { theme, rootPx, authored, animated },
  );
}

async function sourceSvg(page: Page, state: 'default' | 'pressed', scale: number, info: TestInfo) {
  const svg = readFileSync(
    new URL(`./fixtures/button-effects/medium-${state}.svg`, import.meta.url),
    'utf8',
  );
  await page.evaluate(
    ({ svg, scale }) => {
      const host = document.createElement('div');
      host.id = 'source-svg';
      host.style.cssText = `position:fixed;left:1000px;top:0;width:${230 * scale}px;height:${48 * scale}px;pointer-events:none;line-height:0`;
      host.innerHTML = svg;
      const image = host.querySelector('svg');
      if (!image) throw new Error('Нет source SVG');
      image.style.width = '100%';
      image.style.height = '100%';
      document.body.append(host);
    },
    { svg, scale },
  );
  const host = page.locator('#source-svg');
  try {
    return decodePng(await host.screenshot({ path: info.outputPath(`source-${state}.png`) }));
  } finally {
    await host.evaluate((element) => element.remove());
  }
}

function expectRgb(actual: Rgb, expected: readonly number[], label: string, soft = false) {
  for (const channel of [0, 1, 2] as const) {
    const assertion = soft ? expect.soft : expect;
    assertion(
      Math.abs(actual[channel] - (expected[channel] ?? Number.NaN)),
      `${label}: ${actual}`,
    ).toBeLessThanOrEqual(2);
  }
}

async function setState(page: Page, button: Locator, state: State) {
  await page.mouse.up();
  await page.mouse.move(0, 0);
  if (state !== 'default') await button.hover();
  if (state === 'pressed') await page.mouse.down();
}

async function alignToPixels(host: Locator, button: Locator) {
  const box = await button.boundingBox();
  if (!box) throw new Error('Нет области Button');
  // Целый origin и отсутствие scroll исключают смещение PNG-образца.
  // Естественные размеры и содержимое компонента при этом сохраняются.
  await host.evaluate((element) => {
    const style = (element as HTMLElement).style;
    style.position = 'fixed';
    style.left = '100px';
    style.top = '100px';
  });
  const aligned = await button.boundingBox();
  if (!aligned) throw new Error('Нет области Button после переноса');
  await host.evaluate((element, aligned) => {
    const style = (element as HTMLElement).style;
    style.left = `${200 - aligned.x}px`;
    style.top = `${200 - aligned.y}px`;
  }, aligned);
  const snapped = await button.boundingBox();
  if (!snapped) throw new Error('Нет области Button после выравнивания');
  expect(snapped.x).toBe(100);
  expect(snapped.y).toBe(100);
  expect(aligned.width).toBeCloseTo(box.width, 1);
  expect(aligned.height).toBeCloseTo(box.height, 1);
}

async function paint(
  button: Locator,
  host: Locator,
  renderer: Renderer,
  info: TestInfo,
  name: string,
) {
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  if (!box) throw new Error('Button не имеет видимой области');
  const regions = [];
  for (const [name, locator] of [
    ['label', host.locator('[data-label]')],
    ['description', host.getByText('Description', { exact: true })],
    ['start', host.locator('[data-glyph="start"]')],
    ['end', host.locator('[data-glyph="end"]')],
  ] as const) {
    const rect = await locator.boundingBox();
    if (!rect) throw new Error(`Нет области ${name}`);
    const color = await locator.evaluate((element) => {
      // Canvas преобразует только CSS color → sRGB8. Фон и маска glyph —
      // screenshots реального Button, без рисования композиции в подмене.
      const context = document.createElement('canvas').getContext('2d');
      if (!context) throw new Error('Нет CSS color converter');
      context.fillStyle = getComputedStyle(element).color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data) as Rgba;
    });
    regions.push({
      name,
      x: rect.x - box.x,
      y: rect.y - box.y,
      width: rect.width,
      height: rect.height,
      color,
    });
  }
  const path = info.outputPath(`${name}.png`);
  const full = decodePng(await button.screenshot({ path }));
  await info.attach(name, { path, contentType: 'image/png' });
  const content = button.locator(renderer === 'react' ? '.lab-button-content' : '.content');
  await content.evaluate((element) => {
    (element as HTMLElement).style.opacity = '0';
  });
  let background: Png;
  try {
    background = decodePng(await button.screenshot({ path: info.outputPath(`${name}-paint.png`) }));
  } finally {
    await content.evaluate((element) => {
      (element as HTMLElement).style.removeProperty('opacity');
    });
  }
  const contrasts = regions.map((region) => {
    let minimum = Number.POSITIVE_INFINITY;
    let occupied = 0;
    for (
      let y = Math.max(0, Math.floor(region.y));
      y < Math.min(full.height, Math.ceil(region.y + region.height));
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(region.x));
        x < Math.min(full.width, Math.ceil(region.x + region.width));
        x++
      ) {
        const ink = pixel(full, x, y);
        const bg = pixel(background, x, y);
        if (
          ![0, 1, 2].some(
            (channel) => Math.abs(ink[channel as 0 | 1 | 2] - bg[channel as 0 | 1 | 2]) > 4,
          )
        )
          continue;
        occupied++;
        const alpha = region.color[3] / 255;
        const fg = ([0, 1, 2] as const).map(
          (channel) => region.color[channel] * alpha + bg[channel] * (1 - alpha),
        ) as Rgb;
        minimum = Math.min(minimum, contrast(fg, bg));
      }
    }
    expect(occupied, `${name}/${region.name}: видимый paint`).toBeGreaterThan(0);
    return { ...region, occupied, minimum };
  });
  return { box, full, background, contrasts };
}

function contrast(a: Rgb, b: Rgb) {
  const luminance = (rgb: Rgb) => {
    const linear = rgb
      .map((value) => value / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)) as Rgb;
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

async function geometry(button: Locator, renderer: Renderer) {
  return button.evaluate((element, renderer) => {
    const effect = element.querySelector(renderer === 'react' ? '.lab-button-effects' : '.effects');
    if (!effect) throw new Error('Нет слоя эффектов');
    const glow = getComputedStyle(effect, '::after');
    const rect = effect.getBoundingClientRect();
    return {
      base: getComputedStyle(element).backgroundColor,
      width: rect.width,
      height: rect.height,
      gradient: getComputedStyle(effect, '::before').opacity,
      glow: {
        width: Number.parseFloat(glow.width),
        height: Number.parseFloat(glow.height),
        x: Number.parseFloat(glow.left) - rect.width / 2,
        y: Number.parseFloat(glow.top) - rect.height / 2,
        filter: glow.filter,
        opacity: Number(glow.opacity),
      },
      inset: getComputedStyle(element, '::after').boxShadow,
    };
  }, renderer);
}

for (const renderer of ['lit', 'react', 'vue'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const rootPx of [16, 20]) {
      test(`${renderer}: authored effects ${theme} root${rootPx}`, async ({ page }, info) => {
        await setup(page, theme, rootPx, true);
        const report = [];
        try {
          for (const size of ['s', 'm', 'l'] as const) {
            const expected = reference[size];
            const scale = rootPx / 16;
            const host = page.getByTestId(`${renderer}-anatomy-${size}-visual`);
            const button = nativeButton(host, renderer);
            if (size === 'm') {
              // SVG-эталон имеет фиксированную ширину230. Для сравнения kernel
              // совпадает вся геометрия; естественная ширина проверяется anatomy.
              await button.evaluate((element, scale) => {
                (element as HTMLElement).style.width = `${230 * scale}px`;
              }, scale);
            }
            await alignToPixels(host, button);
            await button.evaluate((element) => {
              (element as HTMLElement).style.setProperty('--lab-motion-transition-duration', '0s');
            });
            let base = '';
            for (const state of ['default', 'hover', 'pressed'] as const) {
              await setState(page, button, state);
              const actual = await geometry(button, renderer);
              if (state === 'default') base = actual.base;
              expect.soft(actual.base, 'Состояние сохраняет базовый цвет').toBe(base);
              const rendered = await paint(button, host, renderer, info, `${size}-${state}`);
              const pngComparison = ([0, 1] as const).map((index) => {
                const y = index === 0 ? 4 : expected.height - 2;
                return {
                  y,
                  actual: pixel(rendered.background, rendered.background.width / 2, y * scale),
                  figma: expected[state][index],
                };
              });
              report.push({ size, state, ...actual, contrasts: rendered.contrasts, pngComparison });
              expect.soft(actual.height).toBeCloseTo(expected.height * scale, 1);
              expect.soft(actual.width).toBeCloseTo(rendered.box.width, 1);
              expect.soft(actual.glow.width).toBe(96 * scale);
              expect.soft(actual.glow.height).toBe(96 * scale);
              expect.soft(actual.glow.x).toBeCloseTo(expected.shift * scale, 1);
              expect.soft(actual.glow.y).toBe(0);
              expect.soft(actual.glow.filter).toBe(`blur(${18 * scale}px)`);
              expect
                .soft(actual.glow.opacity)
                .toBeCloseTo(state === 'pressed' ? 0.32 * 0.52 : 0, 5);
              expect
                .soft(Number(actual.gradient))
                .toBe(state === 'default' ? 0.2 : state === 'hover' ? 0.32 : 0.12);
              expect.soft(actual.inset).toContain('inset');
              expect
                .soft(
                  Array.from(actual.inset.matchAll(/(-?[\d.]+)px/g), (value) => Number(value[1])),
                )
                .toEqual([0, state === 'pressed' ? scale : -scale, scale, 0]);
              if (theme === 'light' && rootPx === 16 && state !== 'pressed') {
                expectRgb(
                  pixel(rendered.background, rendered.background.width / 2, 4),
                  expected[state][0],
                  `${size}/${state}: Figma верх градиента`,
                  true,
                );
              }
              // SVG сохраняется как исследовательское наблюдение. Даже один
              // browser не гарантирует эквивалентность SVG и CSS-композиции
              // (VO-1); эти captures не задают исполняемый pixel oracle.
              if (theme === 'light' && size === 'm' && state !== 'hover') {
                await sourceSvg(page, state, scale, info);
              }
            }
          }
        } finally {
          await page.mouse.up();
          await info.attach('authored-report', {
            body: JSON.stringify(report, null, 2),
            contentType: 'application/json',
          });
        }
      });
    }
  }
}

async function ordinarySample(
  page: Page,
  renderer: Renderer,
  size: 's' | 'm' | 'l',
  state: State,
  info: TestInfo,
  name: string,
) {
  const host = page.getByTestId(`${renderer}-anatomy-${size}-visual`);
  const button = nativeButton(host, renderer);
  await host.evaluate(async (element) => {
    await Promise.all(Array.from(element.querySelectorAll('img'), (image) => image.decode()));
  });
  await alignToPixels(host, button);
  await setState(page, button, state);
  const interaction = await button.evaluate((element) => ({
    hover: element.matches(':hover'),
    active: element.matches(':active'),
    focus: element.matches(':focus'),
    focusVisible: element.matches(':focus-visible'),
  }));
  expect(interaction.hover).toBe(state !== 'default');
  expect(interaction.active).toBe(state === 'pressed');
  const content = await host.evaluate((element) => ({
    text: element.textContent,
    images: Array.from(element.querySelectorAll('img'), (image) => ({
      src: image.currentSrc,
      width: image.naturalWidth,
      height: image.naturalHeight,
    })),
  }));
  const rendered = await paint(button, host, renderer, info, name);
  return {
    scene: {
      size,
      state,
      interaction,
      content,
      box: rendered.box,
      regions: rendered.contrasts.map(({ name, x, y, width, height }) => ({
        name,
        x,
        y,
        width,
        height,
      })),
    },
    ...rendered,
  };
}

function imageDifference(actual: Png, expected: Png) {
  let changedChannels = 0;
  let maxDelta = 0;
  for (let i = 0; i < Math.min(actual.rgb.length, expected.rgb.length); i++) {
    const delta = Math.abs((actual.rgb[i] ?? 0) - (expected.rgb[i] ?? 0));
    if (delta > 0) changedChannels++;
    maxDelta = Math.max(maxDelta, delta);
  }
  return {
    sameSize: actual.width === expected.width && actual.height === expected.height,
    changedChannels,
    maxDelta,
  };
}

function ordinaryComparison(
  actual: Awaited<ReturnType<typeof ordinarySample>>,
  authored: Awaited<ReturnType<typeof ordinarySample>>,
) {
  return {
    sameScene: JSON.stringify(actual.scene) === JSON.stringify(authored.scene),
    full: imageDifference(actual.full, authored.full),
    background: imageDifference(actual.background, authored.background),
  };
}

function assertOrdinaryComparison(comparison: ReturnType<typeof ordinaryComparison>, soft = false) {
  const assertion = soft ? expect.soft : expect;
  assertion(comparison, 'Обычный Button сохраняет авторскую сцену и реальные пиксели').toEqual({
    sameScene: true,
    full: { sameSize: true, changedChannels: 0, maxDelta: 0 },
    background: { sameSize: true, changedChannels: 0, maxDelta: 0 },
  });
}

// Авторский контроль закрепляет исходные краски через setup(true). Общий CSS
// эффектов независимо проверяется authored-effects и layer-controls ниже.
// Контраст сохраняется как диагностика ordinary; IC требует отдельного режима.
for (const theme of ['light', 'dark'] as const) {
  for (const renderer of ['lit', 'react', 'vue'] as const) {
    test(`production composite preserves authored ordinary ${theme} ${renderer}`, async ({
      page,
    }, info) => {
      const authored = new Map<string, Awaited<ReturnType<typeof ordinarySample>>>();
      const report = [];
      try {
        for (const mode of ['authored', 'production'] as const) {
          await page.mouse.up();
          await setup(page, theme, 16, mode === 'authored');
          for (const size of ['s', 'm', 'l'] as const) {
            for (const state of ['default', 'hover', 'pressed'] as const) {
              const key = `${size}/${state}`;
              const sample = await ordinarySample(
                page,
                renderer,
                size,
                state,
                info,
                `${mode}-${renderer}-${size}-${state}`,
              );
              if (mode === 'authored') {
                authored.set(key, sample);
                continue;
              }
              const control = authored.get(key);
              if (!control) throw new Error(`Нет авторского контроля ${key}`);
              const comparison = ordinaryComparison(sample, control);
              report.push({ key, scene: sample.scene, comparison, contrasts: sample.contrasts });
              assertOrdinaryComparison(comparison, true);
            }
          }
        }
        const keys = [
          's/default',
          's/hover',
          's/pressed',
          'm/default',
          'm/hover',
          'm/pressed',
          'l/default',
          'l/hover',
          'l/pressed',
        ];
        expect([...authored.keys()]).toEqual(keys);
        expect(report.map(({ key }) => key)).toEqual(keys);
      } finally {
        await page.mouse.up();
        await info.attach('production-report', {
          body: JSON.stringify(report, null, 2),
          contentType: 'application/json',
        });
      }
    });
  }
}

test('ordinary comparison detects changed fill, glyph and overlay on the real Button', async ({
  page,
}, info) => {
  const renderer = 'react';
  const report = [];
  try {
    await setup(page, 'light', 16, true);
    const control = await ordinarySample(page, renderer, 'm', 'pressed', info, 'control');
    await page.mouse.up();
    await setup(page, 'light', 16, false);
    const healthy = await ordinarySample(page, renderer, 'm', 'pressed', info, 'healthy');
    assertOrdinaryComparison(ordinaryComparison(healthy, control));
    const button = page.getByTestId('react-anatomy-m-visual');
    for (const [name, css] of [
      ['fill', '[data-testid="react-anatomy-m-visual"] { --lab-fill-accent: rgb(160 32 32); }'],
      ['glyph', '[data-testid="react-anatomy-m-visual"] { --lab-label-on-accent: rgb(16 16 18); }'],
      [
        'overlay',
        '[data-testid="react-anatomy-m-visual"] .lab-button-effects::before { opacity: 0 !important; }',
      ],
    ] as const) {
      const style = await page.addStyleTag({ content: css });
      try {
        const changed = await ordinarySample(
          page,
          renderer,
          'm',
          'pressed',
          info,
          `changed-${name}`,
        );
        const comparison = ordinaryComparison(changed, control);
        report.push({ name, comparison, contrasts: changed.contrasts });
        expect(comparison.sameScene).toBe(true);
        expect(comparison.full.changedChannels).toBeGreaterThan(0);
        expect(() => assertOrdinaryComparison(comparison)).toThrow();
      } finally {
        await style.evaluate((element) => element.parentNode?.removeChild(element));
      }
    }
    await setState(page, button, 'pressed');
    const restored = await ordinarySample(page, renderer, 'm', 'pressed', info, 'restored');
    assertOrdinaryComparison(ordinaryComparison(restored, control));
  } finally {
    await page.mouse.up();
    await info.attach('ordinary-comparison-controls', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
  }
});

test('effects oracle detects missing layers on the real Button', async ({ page }, info) => {
  await setup(page, 'light', 16, true);
  const button = page.getByTestId('react-anatomy-m-visual');
  await alignToPixels(button, button);
  await button.evaluate((element) => {
    (element as HTMLElement).style.setProperty('--lab-motion-transition-duration', '0s');
  });
  const content = button.locator('.lab-button-content');
  await content.evaluate((element) => {
    (element as HTMLElement).style.opacity = '0';
  });
  const capture = async (name: string) =>
    decodePng(await button.screenshot({ path: info.outputPath(`${name}.png`) }));
  const mutate = async (css: string, name: string) => {
    const style = await page.addStyleTag({ content: css });
    try {
      return await capture(name);
    } finally {
      await style.evaluate((element) => element.parentNode?.removeChild(element));
    }
  };
  // Половина полного source-over вклада исходного paint — нижняя граница
  // заметного присутствия слоя, не допуск соответствия Figma. Сам kernel,
  // размеры и alpha отдельно закреплены authored geometry assertions выше.
  const glowFloor = ((255 - 16) * 0.32 * 0.52) / 2;
  const insetFloor = ((255 - 18) * 0.12) / 2;
  const glowDelta = (paint: Png, absent: Png) =>
    pixel(paint, paint.width / 2, 4)[0] - pixel(absent, absent.width / 2, 4)[0];
  const insetDelta = (paint: Png, absent: Png) =>
    pixel(absent, absent.width / 2, absent.height - 1)[2] -
    pixel(paint, paint.width / 2, paint.height - 1)[2];
  const assertGlow = (paint: Png, absent: Png) =>
    expect(
      glowDelta(paint, absent),
      'Белое центральное свечение имеет заметный вклад',
    ).toBeGreaterThanOrEqual(glowFloor);
  const assertInset = (paint: Png, absent: Png) =>
    expect(insetDelta(paint, absent), 'Default inset затемняет нижний край').toBeGreaterThanOrEqual(
      insetFloor,
    );
  const observations = [];
  try {
    await setState(page, button, 'pressed');
    const healthyGlow = await capture('healthy-glow');
    const noGlow = await mutate(
      '[data-lab-button] .lab-button-effects::after{opacity:0!important}',
      'missing-glow',
    );
    assertGlow(healthyGlow, noGlow);
    expect(() => assertGlow(noGlow, noGlow)).toThrow();
    observations.push({
      layer: 'glow',
      case: 'healthy',
      delta: glowDelta(healthyGlow, noGlow),
      floor: glowFloor,
    });
    for (const [name, declaration] of [
      ['attenuated-glow', `opacity:${(0.32 * 0.52) / 4}!important`],
      ['inverted-glow', 'background-color:rgb(16 16 18)!important'],
    ] as const) {
      const changed = await mutate(
        `[data-lab-button] .lab-button-effects::after{${declaration}}`,
        name,
      );
      expect(() => assertGlow(changed, noGlow)).toThrow();
      observations.push({
        layer: 'glow',
        case: name,
        delta: glowDelta(changed, noGlow),
        floor: glowFloor,
      });
    }
    await setState(page, button, 'default');
    const healthyInset = await capture('healthy-inset');
    const noInset = await mutate(
      '[data-lab-button]::after{box-shadow:none!important}',
      'missing-inset',
    );
    assertInset(healthyInset, noInset);
    expect(() => assertInset(noInset, noInset)).toThrow();
    observations.push({
      layer: 'inset',
      case: 'healthy',
      delta: insetDelta(healthyInset, noInset),
      floor: insetFloor,
    });
    for (const [name, shadow] of [
      ['attenuated-inset', 'inset 0 -1px 1px 0 rgb(16 16 18 / 0.03)'],
      ['inverted-inset', 'inset 0 1px 1px 0 rgb(16 16 18 / 0.12)'],
    ] as const) {
      const changed = await mutate(
        `[data-lab-button]::after{box-shadow:${shadow}!important}`,
        name,
      );
      expect(() => assertInset(changed, noInset)).toThrow();
      observations.push({
        layer: 'inset',
        case: name,
        delta: insetDelta(changed, noInset),
        floor: insetFloor,
      });
    }
  } finally {
    await page.mouse.up();
    await content.evaluate((element) => {
      (element as HTMLElement).style.removeProperty('opacity');
    });
    await info.attach('layer-controls', {
      body: JSON.stringify(observations, null, 2),
      contentType: 'application/json',
    });
  }
});

for (const renderer of ['lit', 'react', 'vue'] as const) {
  test(`${renderer}: effects transition retargets and respects reduced motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await setup(page, 'light', 16, true, true);
    const host = page.getByTestId(`${renderer}-anatomy-m-visual`);
    const button = nativeButton(host, renderer);
    await alignToPixels(host, button);
    await page.mouse.move(0, 0);
    await button.hover();
    const intermediate = await button.evaluate((element, renderer) => {
      const effects = element.querySelector(
        renderer === 'react' ? '.lab-button-effects' : '.effects',
      );
      if (!effects) throw new Error('Нет effects');
      getComputedStyle(effects, '::before').opacity;
      const animations = element.getAnimations({ subtree: true });
      for (const animation of animations) {
        animation.pause();
        const duration = animation.effect?.getComputedTiming().duration;
        if (typeof duration === 'number') animation.currentTime = duration / 2;
      }
      return {
        count: animations.length,
        opacity: Number(getComputedStyle(effects, '::before').opacity),
      };
    }, renderer);
    expect(intermediate.count, 'Hover не переключается мгновенно').toBeGreaterThan(0);
    expect(intermediate.opacity).toBeGreaterThan(0.2);
    expect(intermediate.opacity).toBeLessThan(0.32);
    await page.mouse.move(0, 0);
    const reverse = await button.evaluate((element) => {
      const animations = element.getAnimations({ subtree: true });
      const running = animations.filter((animation) => animation.playState === 'running').length;
      for (const animation of animations) animation.finish();
      return running;
    });
    expect(reverse, 'Прерванный hover начинает обратный переход').toBeGreaterThan(0);
    expect(Number((await geometry(button, renderer)).gradient)).toBe(0.2);
    await button.hover();
    await button.evaluate((element) => {
      for (const animation of element.getAnimations({ subtree: true })) animation.finish();
    });
    await page.mouse.down();
    try {
      const properties = await button.evaluate((element) => {
        const animations = element.getAnimations({ subtree: true });
        const properties = animations
          .filter((animation): animation is CSSTransition => animation instanceof CSSTransition)
          .map((animation) => animation.transitionProperty);
        for (const animation of animations) animation.finish();
        return properties;
      });
      expect(properties).toContain('opacity');
      expect(properties).toContain('color');
      expect(properties).toContain('box-shadow');
      expect(Number((await geometry(button, renderer)).gradient)).toBe(0.12);
    } finally {
      await page.mouse.up();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setState(page, button, 'pressed');
    try {
      expect(
        await button.evaluate((element) => element.getAnimations({ subtree: true }).length),
      ).toBe(0);
      const reduced = await geometry(button, renderer);
      expect(Number(reduced.gradient)).toBe(0.12);
      expect(reduced.glow.opacity).toBeCloseTo(0.32 * 0.52, 5);
    } finally {
      await page.mouse.up();
    }
  });
}
