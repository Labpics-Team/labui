import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { AvatarProps } from '@labpics/ui-react/avatar';
import { type Page, expect, test } from '@playwright/test';

const renderers = ['lit', 'react'] as const;
const colors = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'mint',
  'blue',
  'indigo',
  'purple',
  'pink',
];
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#3586da"/></svg>';
const state = (page: Page, renderer: string) => page.getByTestId(`${renderer}-state`);
const setAvatar = async (page: Page, props: AvatarProps) => {
  await page.evaluate(
    (props) => (window as unknown as { setAvatar: (p: AvatarProps) => void }).setAvatar(props),
    props,
  );
};
const paint = (el: Element) => {
  const s = getComputedStyle(el);
  return {
    color: s.color,
    background: s.backgroundImage,
    family: s.fontFamily,
    weight: s.fontWeight,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    mask: s.maskImage,
  };
};

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/avatar-author.html');
  await expect(state(page, 'react')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('name, letter mark, texture and presence form one accessible image', async ({ page }) => {
  await setAvatar(page, { name: 'Анна Каренина', status: 'online' });
  for (const renderer of renderers) {
    await expect(state(page, renderer).locator('.lab-avatar-initials')).toHaveText('АК');
    await expect(
      renderer === 'lit' ? state(page, renderer).getByRole('img') : state(page, renderer),
    ).toHaveAccessibleName('Анна Каренина, В сети');
  }
  await setAvatar(page, {
    name: 'Полное имя',
    initials: '👩🏽‍💻',
    status: 'away',
    statusLabel: 'Away from keyboard',
  });
  for (const renderer of renderers) {
    await expect(state(page, renderer).locator('.lab-avatar-initials')).toHaveText('👩🏽‍💻');
    await expect(
      renderer === 'lit' ? state(page, renderer).getByRole('img') : state(page, renderer),
    ).toHaveAccessibleName('Полное имя, Away from keyboard');
  }
  await setAvatar(page, {
    name: 'Полное имя',
    fallback: 'texture',
    decorative: true,
    status: 'dnd',
  });
  for (const renderer of renderers) {
    await expect(state(page, renderer).locator('.lab-avatar-texture')).toHaveCount(1);
    await expect(state(page, renderer).locator('.lab-avatar-initials')).toHaveCount(0);
    const image =
      renderer === 'lit'
        ? state(page, renderer).locator('[data-lab-avatar]')
        : state(page, renderer);
    await expect(image).not.toHaveAttribute('role');
    await expect(image).not.toHaveAttribute('aria-label');
    await expect(image).toHaveAttribute('aria-hidden', 'true');
  }
  await setAvatar(page, { name: '', src: '  ' });
  for (const renderer of renderers) {
    await expect(state(page, renderer).locator('img')).toHaveCount(0);
    await expect(state(page, renderer).locator('.lab-avatar-texture')).toHaveCount(1);
  }
});

test('ten author colors share geometry, a real rounded font and theme roles', async ({ page }) => {
  expect(await page.evaluate(() => document.fonts.check('800 14px "Sunghyun Sans"', 'Д'))).toBe(
    true,
  );
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const [size, diameter] of [
      ['s', 24],
      ['m', 32],
      ['l', 48],
    ] as const) {
      for (const color of colors) {
        const lit = page.getByTestId(`lit-${size}-${color}`);
        const react = page.getByTestId(`react-${size}-${color}`);
        for (const avatar of [lit, react]) {
          const box = await avatar.boundingBox();
          expect(box?.width).toBe(diameter);
          expect(box?.height).toBe(diameter);
        }
        const actual = await react.locator('.lab-avatar-initials').evaluate(paint);
        expect(actual).toEqual(await lit.locator('.lab-avatar-initials').evaluate(paint));
        expect(actual.family).toContain('Sunghyun Sans');
        expect(actual.weight).toBe('800');
        expect(
          await react
            .locator('.lab-avatar-status')
            .evaluate((el) => getComputedStyle(el).backgroundColor),
        ).toEqual(
          await lit
            .locator('.lab-avatar-status')
            .evaluate((el) => getComputedStyle(el).backgroundColor),
        );
      }
    }
  }
  await page.evaluate(() =>
    document.documentElement.style.setProperty('--lab-avatar-fill-blue', 'rgb(1, 2, 3)'),
  );
  for (const renderer of renderers)
    expect(
      await page
        .getByTestId(`${renderer}-m-blue`)
        .locator('.lab-avatar-initials')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe('rgb(1, 2, 3)');
});

test('presence cutout follows RTL and the whole avatar scales with text', async ({ page }) => {
  await setAvatar(page, { name: 'Александра', status: 'online' });
  for (const dir of ['ltr', 'rtl']) {
    await page.evaluate((dir) => {
      document.documentElement.dir = dir;
    }, dir);
    for (const renderer of renderers) {
      const avatar = state(page, renderer);
      const box = await avatar.boundingBox();
      const dot = await avatar.locator('.lab-avatar-status').boundingBox();
      expect(dot?.width).toBe(8);
      expect(dot?.height).toBe(8);
      expect((dot?.x ?? 0) - (box?.x ?? 0)).toBe(dir === 'rtl' ? 0 : 24);
      expect((await avatar.locator('.lab-avatar-disc').evaluate(paint)).mask).toContain(
        dir === 'rtl' ? '4px' : '100% - 4px',
      );
    }
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  for (const renderer of renderers) {
    expect((await state(page, renderer).boundingBox())?.width).toBe(64);
    expect((await state(page, renderer).locator('.lab-avatar-status').boundingBox())?.width).toBe(
      16,
    );
  }
});

test('decoded images replace fallback; failure and old requests cannot hide it', async ({
  page,
}) => {
  let releaseSlow!: () => void;
  const slow = new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  await page.route('**/avatar-slow.svg', async (route) => {
    await slow;
    await route.fulfill({ contentType: 'image/svg+xml', body: svg });
  });
  await page.route('**/avatar-ok.svg', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: svg }),
  );
  await page.route('**/avatar-error.svg', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  );
  await setAvatar(page, { name: 'Надежда', src: '/avatar-slow.svg' });
  for (const renderer of renderers) {
    await expect(state(page, renderer).locator('img')).toHaveCSS('opacity', '0');
    await expect(state(page, renderer).locator('.lab-avatar-initials')).toHaveText('Н');
  }
  await page.evaluate(() =>
    Object.assign(window, {
      previousAvatarImages: [
        document.querySelector('[data-testid="lit-state"]')?.shadowRoot?.querySelector('img'),
        document.querySelector('[data-testid="react-state"] img'),
      ],
    }),
  );
  await setAvatar(page, { name: 'Надежда', src: '/avatar-ok.svg' });
  for (const renderer of renderers) {
    await expect(state(page, renderer).locator('img')).toHaveCSS('opacity', '1');
    await expect(state(page, renderer).locator('.lab-avatar-initials')).toBeHidden();
  }
  await setAvatar(page, { name: 'Надежда', src: '/avatar-error.svg' });
  for (const renderer of renderers)
    await expect(state(page, renderer).locator('img')).toHaveCSS('opacity', '0');
  releaseSlow();
  await page.evaluate(() => {
    for (const image of (window as unknown as { previousAvatarImages: HTMLImageElement[] })
      .previousAvatarImages)
      image.dispatchEvent(new Event('load'));
  });
  for (const renderer of renderers) {
    await expect(state(page, renderer).locator('img')).toHaveCSS('opacity', '0');
    await expect(state(page, renderer).locator('.lab-avatar-initials')).toHaveText('Н');
  }
  await setAvatar(page, { name: 'Надежда', src: '/avatar-ok.svg' });
  for (const renderer of renderers)
    await expect(state(page, renderer).locator('img')).toHaveCSS('opacity', '1');
});

test('SSR images loaded before hydration are reused and decoded on Lit and React', async ({
  browser,
  baseURL,
}) => {
  const adapter = new URL('../../../packages/vue/dist/ssr.js', import.meta.url).href;
  const react = new URL('../../../packages/react/dist/avatar.js', import.meta.url).href;
  const props = { name: 'Даниил', initials: 'Д', src: '/avatar-cache.svg' };
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    const {renderAvatar}=await import(${JSON.stringify(adapter)});
    const {Avatar}=await import(${JSON.stringify(react)});
    const {createElement}=await import('react');
    const {renderToString}=await import('react-dom/server');
    const props=${JSON.stringify(props)};
    process.stdout.write(renderAvatar(props)+'<div id="react-ssr">'+renderToString(createElement(Avatar,{...props,'data-testid':'react-ssr-avatar'}))+'</div>');
  `,
    ],
    { encoding: 'utf8' },
  );
  expect(output).toContain('shadowrootmode="open"');
  const css = readFileSync(
    new URL('../../../packages/core/dist/avatar.css', import.meta.url),
    'utf8',
  );
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  let hydrate!: () => void;
  const hold = new Promise<void>((resolve) => {
    hydrate = resolve;
  });
  try {
    await page.route('**/@vite/client', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: '' }),
    );
    await page.route('**/avatar-cache.svg', (route) =>
      route.fulfill({ contentType: 'image/svg+xml', body: svg }),
    );
    await page.route('**/avatar-ssr.html', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace(
          '<!-- SSR-AVATAR -->',
          `<style>${css}</style>${output}`,
        ),
      });
    });
    await page.route(/avatar-ssr.*\.(?:tsx|js)(?:\?.*)?$/, async (route) => {
      await hold;
      await route.continue();
    });
    await page.goto(`${baseURL}/_fixtures/avatar-ssr.html`, { waitUntil: 'commit' });
    await page.waitForFunction(() => {
      const images = [
        document.querySelector('lab-avatar')?.shadowRoot?.querySelector('img'),
        document.querySelector('#react-ssr img'),
      ];
      return images.every(
        (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
      );
    });
    await page.evaluate(() =>
      Object.assign(window, {
        ssrAvatarImages: [
          document.querySelector('lab-avatar')?.shadowRoot?.querySelector('img'),
          document.querySelector('#react-ssr img'),
        ],
      }),
    );
    hydrate();
    await page.waitForFunction(
      () => (window as unknown as { avatarHydrated: boolean }).avatarHydrated,
    );
    for (const image of [page.locator('lab-avatar img'), page.locator('#react-ssr img')])
      await expect(image).toHaveCSS('opacity', '1');
    expect(
      await page.evaluate(() => {
        const originals = (window as unknown as { ssrAvatarImages: HTMLImageElement[] })
          .ssrAvatarImages;
        return (
          originals[0] === document.querySelector('lab-avatar')?.shadowRoot?.querySelector('img') &&
          originals[1] === document.querySelector('#react-ssr img')
        );
      }),
    ).toBe(true);
    await page.evaluate(() => {
      const avatar = document.querySelector('lab-avatar');
      if (avatar) {
        avatar.src = undefined;
        avatar.initials = 'Я';
      }
      (window as unknown as { updateReactAvatar: (p: AvatarProps) => void }).updateReactAvatar({
        name: 'Яна',
        initials: 'Я',
      });
    });
    await expect(page.locator('lab-avatar .lab-avatar-initials')).toHaveText('Я');
    await expect(page.locator('#react-ssr .lab-avatar-initials')).toHaveText('Я');
    expect(errors).toEqual([]);
  } finally {
    hydrate();
    await page.close();
  }
});
