import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Card suite — a PRESENTATIONAL component that OPTS OUT of the Zag seam (like
 * Badge / Loader), verified on BOTH renderers.
 *
 * The fixture (`card.html`) mounts the Lit `<lab-card>` and the native-React
 * `<Card>` with identical specimens under one [data-theme]. Because Card has no
 * machine, these checks assert STRUCTURE + native semantics + visual parity — NOT
 * machine output (there is none to assert, and faking some would be dishonest):
 *   1. Render — both renderers paint a real <article> surface with a token.
 *   2. Native semantics — header / footer are real landmark elements.
 *   3. Variant — each variant resolves a distinct surface background.
 *   4. Visual parity — matching specimens resolve the SAME background colour.
 *   5. Tokens + theme — re-pointing a role / flipping [data-theme] re-skins both.
 *   6. Interactive a11y — the `interactive` variant pins the P5 trap the component
 *      itself flags: an interactive card with no keyboard operability. The specimen
 *      slots a REAL <button>; we assert (a) :focus-within draws the
 *      --lab-border-focus ring (focus delegates from the host), and (b) the control
 *      is Tab-reachable. The card never fabricates a role — the action is the
 *      slotted control's, so keyboard operability is genuine, not faked.
 */

/** The Lit card's painted <article> surface (shadow-pierced). */
function litCard(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.card');
}
/** The React card IS the <article> surface. */
function reactCard(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** Материал Elevated относится к Content; article сохраняет семантику и focus. */
function elevatedContent(page: Page, renderer: 'lit' | 'react'): Locator {
  return page
    .getByTestId(`${renderer}-elevated`)
    .locator(renderer === 'lit' ? '.content' : '.lab-card-content');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
const outlineStyle = (el: HTMLElement) => getComputedStyle(el).outlineStyle;
const outlineColor = (el: HTMLElement) => getComputedStyle(el).outlineColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/card.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/card.html')).text();
  expect(body).toMatch(/<lab-card/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers paint an <article> surface', async ({ page }) => {
  for (const card of [litCard(page, 'lit-elevated'), reactCard(page, 'react-elevated')]) {
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => el.tagName.toLowerCase())).toBe('article');
  }
});

test('catalogue: Card → Sheet применяет настройки и возвращает focus настоящему Button', async ({
  page,
}) => {
  await page.goto('/components.html?component=card');
  const card = page.locator('#sec-live').getByTestId('notification-settings');
  const trigger = card.getByRole('button', { name: 'Настроить', exact: true });
  await expect(trigger).toBeVisible();
  await expect(card.getByRole('button')).toHaveCount(1);
  const relation = await trigger.evaluate((element) => {
    const root = element.getRootNode();
    const controlled = root instanceof ShadowRoot ? root.host.parentElement : null;
    const references = 'ariaControlsElements' in element ? element.ariaControlsElements : null;
    return {
      native: element instanceof HTMLButtonElement,
      controlledTag: controlled?.localName,
      resolved: Array.isArray(references) && references.includes(controlled),
    };
  });
  expect(relation).toEqual({ native: true, controlledTag: 'lab-sheet', resolved: true });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Настройки уведомлений', exact: true });
  await expect(panel).toBeVisible();
  const comments = card.getByTestId('comments-enabled').getByRole('switch');
  await expect(comments).toBeChecked();
  await comments.click();
  await expect(comments).not.toBeChecked();
  await card.getByTestId('settings-done').getByRole('button').click();
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(
    card.getByText('Уведомления включены. Комментарии выключены.', { exact: true }),
  ).toBeVisible();

  await card.getByTestId('notification-enabled').getByRole('switch').click();
  await expect(card.getByText('Уведомления выключены.', { exact: true })).toBeVisible();
  await trigger.click();
  await expect(comments).toBeDisabled();
  await expect(comments).not.toBeChecked();
  await card.getByTestId('settings-done').getByRole('button').click();
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('catalogue: замена Button открытого Sheet меняет актуальный final-focus target', async ({
  page,
}) => {
  await page.goto('/components.html?component=card');
  const card = page.locator('#sec-live').getByTestId('notification-settings');
  await card.getByRole('button', { name: 'Настроить', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Настройки уведомлений', exact: true });
  await expect(panel).toBeVisible();
  await card.getByTestId('settings-trigger').evaluate((host) => {
    const replacement = document.createElement('lab-button');
    replacement.slot = 'trigger';
    replacement.type = 'neutral';
    replacement.kind = 'border';
    replacement.dataset.material = 'solid';
    replacement.textContent = 'Другие настройки';
    host.replaceWith(replacement);
  });
  const replacement = card.getByRole('button', { name: 'Другие настройки', exact: true });
  const done = card.getByTestId('settings-done').getByRole('button');
  await done.focus();
  await expect(done).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(replacement).toBeFocused();
  await replacement.click();
  await expect(panel).toBeVisible();
  await done.click();
  await expect(panel).toBeHidden();
  await expect(replacement).toBeFocused();
});

test('composition: header и footer сохраняют содержимое и порядок в обоих renderers', async ({
  page,
}) => {
  // Native slots передают семантику caller nodes. Наличие частной wrapper-теги
  // не является контрактом; header/footer внутри article также не landmarks.
  for (const renderer of ['lit', 'react'] as const) {
    const host = page.getByTestId(`${renderer}-elevated`);
    const header = host.getByText('Elevated', { exact: true });
    const footer = host.getByText('Footer', { exact: true });
    await expect(header).toBeVisible();
    await expect(footer).toBeVisible();
    // Строковый React prop рисуется через display:contents; измеряем текст,
    // а не отсутствующий box частного wrapper.
    const textBox = (element: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect();
      return { y: rect.y, height: rect.height };
    };
    const headerBox = await header.evaluate(textBox);
    const footerBox = await footer.evaluate(textBox);
    expect(headerBox.height).toBeGreaterThan(0);
    expect(footerBox.height).toBeGreaterThan(0);
    expect(footerBox.y).toBeGreaterThan(headerBox.y + headerBox.height);
  }
});

test('opt-out honesty: the host carries no machine role on the surface', async ({ page }) => {
  // A presentational card must NOT fabricate a widget role on its surface. The
  // <article> is its own semantics; no role="button"/"region"/etc. is injected.
  const litRole = await litCard(page, 'lit-elevated').getAttribute('role');
  const reactRole = await reactCard(page, 'react-elevated').getAttribute('role');
  expect(litRole).toBeNull();
  expect(reactRole).toBeNull();
});

test('variants: elevated / outlined / filled resolve distinct surfaces (both renderers)', async ({
  page,
}) => {
  for (const prefix of ['lit', 'react'] as const) {
    const elevated = elevatedContent(page, prefix);
    const outlined =
      prefix === 'lit' ? litCard(page, 'lit-outlined') : reactCard(page, 'react-outlined');
    const filled = prefix === 'lit' ? litCard(page, 'lit-filled') : reactCard(page, 'react-filled');

    const elevatedBg = await elevated.evaluate(bg);
    const filledBg = await filled.evaluate(bg);
    // Filled is a tinted surface, distinct from the raised elevated surface.
    expect(filledBg).not.toBe(elevatedBg);
    // Source INSIDE stroke рисуется поверх и не отнимает место у содержимого.
    const outlinedBorder = await outlined.evaluate((el) => {
      const paint = getComputedStyle(el, '::after');
      return {
        layout: getComputedStyle(el).borderTopWidth,
        width: paint.borderTopWidth,
        style: paint.borderTopStyle,
        color: paint.borderTopColor,
      };
    });
    expect(outlinedBorder.layout).toBe('0px');
    expect(outlinedBorder.width).not.toBe('0px');
    expect(outlinedBorder.style).toBe('solid');
    expect(outlinedBorder.color).not.toBe('rgba(0, 0, 0, 0)');
  }
});

test('visual parity: Lit and React resolve the same elevated surface colour', async ({ page }) => {
  const litBg = await elevatedContent(page, 'lit').evaluate(bg);
  const reactBg = await elevatedContent(page, 'react').evaluate(bg);
  expect(reactBg).toBe(litBg);
});

test('tokens: re-pointing --lab-bg-grouped-secondary re-skins BOTH elevated cards', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-bg-grouped-secondary', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => elevatedContent(page, 'lit').evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => elevatedContent(page, 'react').evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('interactive a11y: :focus-within draws the --lab-border-focus ring (both renderers)', async ({
  page,
}) => {
  // The P5 trap the component flags is an interactive card with no keyboard
  // operability. The specimen slots a REAL <button>; focusing it must light the
  // host's :focus-within ring. We prove the ring (a) is ABSENT when nothing inside
  // is focused, (b) APPEARS as a solid outline on focus, and (c) reads the
  // --lab-border-focus role — asserted by re-pointing that token and watching the
  // outline colour follow (the suite's honest token idiom, not a hardcoded hex).
  const cases = [
    {
      surface: litCard(page, 'lit-interactive'),
      control: page.getByTestId('lit-interactive-control'),
    },
    {
      surface: reactCard(page, 'react-interactive'),
      control: page.getByTestId('react-interactive-control'),
    },
  ];

  for (const { surface, control } of cases) {
    // (a) No ring before focus — outline is not drawn on a resting interactive card.
    expect(await surface.evaluate(outlineStyle)).toBe('none');

    // (b) Focusing the inner control lights the host's :focus-within ring.
    await control.focus();
    await expect(control).toBeFocused();
    await expect.poll(() => surface.evaluate(outlineStyle)).toBe('solid');

    // (c) The ring reads the --lab-border-focus role: re-point it, the outline follows.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--lab-border-focus', 'rgb(1, 2, 3)');
    });
    await expect.poll(() => surface.evaluate(outlineColor)).toBe('rgb(1, 2, 3)');

    // Clean up the override so each renderer starts from the same token state.
    await page.evaluate(() => {
      document.documentElement.style.removeProperty('--lab-border-focus');
    });
  }
});

test('interactive a11y: the slotted control is Tab-reachable (both renderers)', async ({
  page,
}) => {
  // Keyboard operability is the load-bearing half of the P5 fix: the action must be
  // reachable by Tab, not just by mouse. From a stable anchor at the top of the page
  // (the theme <select>), Tab must eventually land focus on each renderer's real
  // control — proof the control sits in the natural tab order, not removed from it.
  for (const controlId of ['lit-interactive-control', 'react-interactive-control']) {
    const control = page.getByTestId(controlId);
    // tabindex must not exclude it from the tab order.
    expect(await control.getAttribute('tabindex')).not.toBe('-1');

    // Walk the tab order from the page's first focusable element. Bounded so a
    // regression that drops the control from the order fails fast instead of hanging.
    await page.getByTestId('theme-select').focus();
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await control.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
  }
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const litDark = await litCard(page, 'lit-outlined').evaluate(bg);
  const reactDark = await reactCard(page, 'react-outlined').evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => litCard(page, 'lit-outlined').evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => reactCard(page, 'react-outlined').evaluate(bg)).not.toBe(reactDark);
});

/**
 * Behavioral E2 tests for forced-colors + reduced-transparency on focus ring (key
 * interactive field: the slotted button inside interactive card). Per #135 + playbook
 * (E2 emulateMedia). Verifies outline-based canon survives (visible solid outline
 * under forcedColors: active; reduced-transp via CDP). Ties to a11y-perf: forced
 * color users get reliable focus without extra paint cost of dropped shadows.
 *
 * Uses computed outline (style + width) — follows canon from core-contract + foundation:
 * outline (not box-shadow) so UA forced palette + high-contrast applies.
 */
test('forced-colors: emulateMedia makes focus ring outline visible on key interactive (both renderers) — #135', async ({
  page,
}) => {
  const cases = [
    {
      surface: litCard(page, 'lit-interactive'),
      control: page.getByTestId('lit-interactive-control'),
    },
    {
      surface: reactCard(page, 'react-interactive'),
      control: page.getByTestId('react-interactive-control'),
    },
  ];

  for (const { surface, control } of cases) {
    // reset state
    await page.emulateMedia({ forcedColors: null });
    // (a) resting no outline
    expect(await surface.evaluate(outlineStyle)).toBe('none');

    await page.emulateMedia({ forcedColors: 'active' });
    await control.focus();
    await expect(control).toBeFocused();

    // (b) under forced-colors: outline IS visible (solid) and has width — canon survives
    await expect.poll(() => surface.evaluate(outlineStyle)).toBe('solid');
    const outlineW = await surface.evaluate((el) => getComputedStyle(el).outlineWidth);
    expect(outlineW, 'outline width >0 under forcedColors').not.toBe('0px');

    // color follows token even under UA override (best-effort; UA may remap but width+style hold)
    // restore for next
    await page.emulateMedia({ forcedColors: null });
  }
});

test('reduced-transparency: focus ring outline remains visible (CDP emulate, both renderers) — #135', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP emulation is Chromium-only');
  const cases = [
    {
      surface: litCard(page, 'lit-interactive'),
      control: page.getByTestId('lit-interactive-control'),
    },
    {
      surface: reactCard(page, 'react-interactive'),
      control: page.getByTestId('react-interactive-control'),
    },
  ];

  for (const { surface, control } of cases) {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });

    await control.focus();
    await expect(control).toBeFocused();

    // outline ring must stay (a11y not sacrificed under reduced-transp material fallback)
    await expect.poll(() => surface.evaluate(outlineStyle)).toBe('solid');
    const outlineW = await surface.evaluate((el) => getComputedStyle(el).outlineWidth);
    expect(outlineW, 'outline width >0 under reduced-transparency').not.toBe('0px');
  }
});
