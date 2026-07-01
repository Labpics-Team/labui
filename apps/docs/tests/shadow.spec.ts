import { expect, test } from '@playwright/test';

/**
 * Shadow-stack smoke. Proves the generated @labpics/ui-shadow contract is wired
 * into the demo and behaves to the owner's verdict (2026-06-13):
 *   1. the five sizes + four role aliases + global angle + alpha contract resolve;
 *   2. each card resolves to a real four-ply box-shadow (equal-layeredness);
 *   3. the default light is vertical (angle 0 → offset-x 0);
 *   4. elevation changes ease (the motion token wires `transition: box-shadow`);
 *   5. on the dark theme the shadow is darker than the surface — never a glow;
 *   6. on the dark theme the five elevation surfaces are orderable by luminance
 *      (the dark-theme elevation model — depth reads from the surface when the
 *      shadow has no contrast on a near-black page).
 *
 * These assert behaviour (resolved computed styles), not pixels, so they are not
 * flaky; the side-by-side visual baseline lives in visual-parity-harness.
 */

const SHADOW_URL = '/shadow.html';

async function rootVar(page: import('@playwright/test').Page, name: string): Promise<string> {
  return page.evaluate(
    (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
    name,
  );
}

function boxShadow(page: import('@playwright/test').Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => getComputedStyle(el).boxShadow);
}

const SIZES = ['xs', 's', 'm', 'l', 'xl'] as const;
const ROLES = ['resting', 'raised', 'overlay', 'modal'] as const;

test('contract resolves: vertical angle, four alphas, five sizes, four roles', async ({ page }) => {
  await page.goto(SHADOW_URL);

  // Owner default: vertical light.
  expect(await rootVar(page, '--lab-light-angle')).toBe('0deg');

  for (const slot of ['s1', 's2', 's3', 's4']) {
    const alpha = await rootVar(page, `--lab-shadow-alpha-${slot}`);
    expect(Number.parseFloat(alpha)).toBeGreaterThan(0);
  }

  for (const size of SIZES) {
    expect((await rootVar(page, `--lab-shadow-${size}`)).length).toBeGreaterThan(0);
  }
  for (const role of ROLES) {
    expect((await rootVar(page, `--lab-elevation-${role}`)).length).toBeGreaterThan(0);
  }
});

test('every card resolves to a real four-ply box-shadow (equal-layeredness)', async ({ page }) => {
  await page.goto(SHADOW_URL);

  for (const id of [...SIZES.map((s) => `card-${s}`), ...ROLES.map((r) => `card-${r}`)]) {
    const shadow = await boxShadow(page, id);
    expect(shadow, id).not.toBe('none');
    // Four plies → four colour stops. Browsers serialize color-mix as
    // color(srgb ...) or rgba(...) depending on engine; count both.
    const plies = shadow.match(/color\(srgb|rgba?\(/g) ?? [];
    expect(plies.length, id).toBe(4);
  }
});

test('default light is vertical: every ply has zero horizontal offset', async ({ page }) => {
  await page.goto(SHADOW_URL);

  for (const size of SIZES) {
    const shadow = await boxShadow(page, `card-${size}`);
    // Computed box-shadow serializes as `<color> <x> <y> <blur>` per ply. The
    // owner ladder is vertical: x = 0 for every ply at the default angle.
    const plies = shadow.split(/,(?![^(]*\))/);
    for (const ply of plies) {
      const nums = ply.match(/-?\d+(?:\.\d+)?px/g) ?? [];
      // First px token is the x-offset; it must be exactly 0px.
      expect(nums[0], `${size}: ${ply}`).toBe('0px');
    }
  }
});

test('elevation grows: XL casts a larger shadow than XS', async ({ page }) => {
  await page.goto(SHADOW_URL);

  const maxToken = (s: string): number =>
    Math.max(
      ...(s.match(/-?\d+(?:\.\d+)?px/g) ?? ['0px']).map((t) => Math.abs(Number.parseFloat(t))),
    );

  const xs = maxToken(await boxShadow(page, 'card-xs'));
  const xl = maxToken(await boxShadow(page, 'card-xl'));
  expect(xl).toBeGreaterThan(xs);
});

test('elevation changes ease — the motion token wires a box-shadow transition', async ({
  page,
}) => {
  await page.goto(SHADOW_URL);

  // The size/role classes carry `transition: var(--lab-shadow-transition)`. The
  // resolved transition-property must include box-shadow with a non-zero
  // duration, so a state change tweens instead of snapping (owner verdict c).
  const t = await page.getByTestId('card-m').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { prop: cs.transitionProperty, dur: cs.transitionDuration };
  });
  expect(t.prop).toContain('box-shadow');
  const seconds = (t.dur.split(',')[0] ?? '0s').trim();
  expect(Number.parseFloat(seconds)).toBeGreaterThan(0);
});

test('prefers-reduced-motion: every decorative transition collapses to 0s', async ({ page }) => {
  // The page eases elevation/theme changes by default; under reduced-motion the
  // @media guard must drop ALL of them (body, toggle, every card) to an instant
  // state change. Emulate the preference at the page level (project `use` does
  // not carry it) so the assertion exercises the real cascade.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(SHADOW_URL);

  const matches = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(matches).toBe(true);

  const duration = (el: Element): string => getComputedStyle(el).transitionDuration;
  const durations = await Promise.all([
    page.locator('body').first().evaluate(duration),
    page.getByTestId('theme-toggle').evaluate(duration),
    page.getByTestId('card-xs').evaluate(duration),
  ]);

  for (const value of durations) {
    for (const part of value.split(',')) {
      expect(Number.parseFloat(part), value).toBe(0);
    }
  }
});

test('shadow is the neutral anchor, never pure black; tint is opt-in', async ({ page }) => {
  await page.goto(SHADOW_URL);

  const neutral = await boxShadow(page, 'card-xl');
  expect(neutral).not.toMatch(/rgba?\(\s*0\s*,\s*0\s*,\s*0/);
  expect(neutral).not.toMatch(/color\(srgb\s+0\s+0\s+0\b/);

  // The opt-in tinted card raises tint strength + sets a hue; its shadow differs
  // from the neutral card's, proving the tint flows into the colour.
  const tinted = await boxShadow(page, 'card-tinted-xl');
  expect(tinted).not.toBe(neutral);
});

test('dark theme: the shadow is darker than the surface — a shadow, not a glow', async ({
  page,
}) => {
  await page.goto(SHADOW_URL);
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // The card surface now eases (`background 200ms`) as part of the dark-theme
  // elevation model (depth reads from a lighter surface when the shadow has no
  // contrast on a near-black page). Settle that transition before measuring, so
  // we read the resolved surface — not an intermediate `oklab()` interpolation.
  await page.getByTestId('card-xl').evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const settled = getComputedStyle(el).transitionDuration === '0s';
        if (settled) return resolve();
        const done = () => resolve();
        el.addEventListener('transitionend', done, { once: true });
        setTimeout(done, 400);
      }),
  );

  // Relative luminance of an `rgb()/rgba()` or `color(srgb r g b)` string.
  const luminance = (color: string): number => {
    const srgb = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (srgb) {
      return 0.2126 * Number(srgb[1]) + 0.7152 * Number(srgb[2]) + 0.0722 * Number(srgb[3]);
    }
    const rgb = color.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
    if (rgb) {
      return (0.2126 * Number(rgb[1]) + 0.7152 * Number(rgb[2]) + 0.0722 * Number(rgb[3])) / 255;
    }
    return Number.NaN;
  };

  // The card surface and its strongest (first) shadow ply, both as the engine
  // resolves them on the dark theme.
  const { surface, ply } = await page.getByTestId('card-xl').evaluate((el) => {
    const cs = getComputedStyle(el);
    const shadow = cs.boxShadow;
    const firstColor = shadow.match(/(?:color\(srgb[^)]*\)|rgba?\([^)]*\))/)?.[0] ?? '';
    return { surface: cs.backgroundColor, ply: firstColor };
  });

  const surfaceL = luminance(surface);
  const shadowL = luminance(ply);
  expect(Number.isNaN(surfaceL)).toBe(false);
  expect(Number.isNaN(shadowL)).toBe(false);
  // The composite shadow ink is the #101012 anchor at low alpha — strictly
  // darker than the dark surface it sits on. Never a glow.
  expect(shadowL).toBeLessThan(surfaceL);
});

test('dark theme: the five elevation surfaces are orderable by luminance (the ladder reads)', async ({
  page,
}) => {
  // CLASS lock for the confirmed High finding: on a near-black page the drop
  // shadow has ~zero luminance contrast against its surround (shadow ink #101012
  // == page bg), so depth must be carried by the SURFACE — each level lighter
  // than the one below (dark-theme elevation model; Material Design dark theme).
  // If a future change flattens the surfaces back to one colour, the elevation
  // ladder becomes unorderable in the dark again — this test catches that.
  await page.goto(SHADOW_URL);
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const lums = await page.evaluate(async () => {
    const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const weightedLum = (channels: number[]): number =>
      0.2126 * toLin(channels[0] ?? Number.NaN) +
      0.7152 * toLin(channels[1] ?? Number.NaN) +
      0.0722 * toLin(channels[2] ?? Number.NaN);
    const luminance = (color: string): number => {
      const srgb = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      if (srgb) {
        return weightedLum(srgb.slice(1, 4).map(Number));
      }
      const rgb = color.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
      if (rgb) {
        return weightedLum(rgb.slice(1, 4).map((v) => Number(v) / 255));
      }
      return Number.NaN;
    };
    // Settle the surface easing, then read all five levels.
    await new Promise((r) => setTimeout(r, 400));
    const ids = ['card-xs', 'card-s', 'card-m', 'card-l', 'card-xl'];
    return ids.map((id) =>
      luminance(getComputedStyle(document.querySelector(`[data-testid="${id}"]`)!).backgroundColor),
    );
  });

  expect(lums).toHaveLength(5);
  for (const value of lums) {
    expect(Number.isNaN(value)).toBe(false);
  }
  // Strictly increasing: every level is perceptibly lighter than the one below.
  for (let i = 1; i < lums.length; i += 1) {
    const lower = lums[i - 1] ?? Number.NaN;
    const upper = lums[i] ?? Number.NaN;
    expect(upper, `level ${i} must be lighter than level ${i - 1}`).toBeGreaterThan(lower);
  }
});

test('body copy stays within the readable measure (45–75ch) on every body style', async ({
  page,
}) => {
  // CLASS lock for the confirmed High finding: a rem-based max-width (46rem/736px)
  // floated free of the font and ran the lede to ~85ch font-true (up to ~103ch as
  // rendered) — and was WORSE on the smaller 14px config-note (~97ch). The fix caps
  // the measure in ch (the font's own advance unit), so the readable line length
  // holds for EVERY body style regardless of font-size. This test measures the
  // font-true capacity (container width / '0' advance, immune to lucky wrapping)
  // for every body paragraph and fails if any leaves the 45–75ch comfortable band.
  await page.goto(SHADOW_URL);

  const caps = await page.evaluate(() => {
    const sels = ['p.lede', 'p.config-note'];
    const els = sels.flatMap((s) => [...document.querySelectorAll<HTMLElement>(s)]);
    return els.map((el) => {
      const cs = getComputedStyle(el);
      const width = el.getBoundingClientRect().width;
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return { tag: el.className, cap: Number.NaN };
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const zero = ctx.measureText('0').width;
      return { tag: el.className, fontSize: cs.fontSize, cap: width / zero };
    });
  });

  expect(caps.length).toBeGreaterThanOrEqual(3); // 2 ledes + 1 config-note
  for (const { tag, fontSize, cap } of caps) {
    expect(Number.isNaN(cap)).toBe(false);
    expect(cap, `${tag} (${fontSize}) measure ${cap.toFixed(1)}ch must be ≤ 75`).toBeLessThanOrEqual(
      75,
    );
    expect(
      cap,
      `${tag} (${fontSize}) measure ${cap.toFixed(1)}ch must be ≥ 45`,
    ).toBeGreaterThanOrEqual(45);
  }
});

test('every specimen group is titled by a VISIBLE heading wired to its grid; the primary ladder leads', async ({
  page,
}) => {
  // CLASS lock for the confirmed High finding (inverted label hierarchy): the
  // PRIMARY group (the XS..XL size ladder — the actual deliverable) had NO
  // visible heading and was labelled only by an aria-label invisible to sighted
  // users, while the two DERIVED groups (roles, tint) each had a visible H2. A
  // sighted maintainer scanning headings could not locate the core ladder. This
  // test fails if any specimen grid is labelled by an aria-label only, if any
  // labelledby heading is not actually rendered, or if the primary ladder is not
  // the first (and weightiest) section heading.
  await page.goto(SHADOW_URL);

  const ia = await page.evaluate(() => {
    const isVisible = (el: Element | null) =>
      !!el && (el as HTMLElement).offsetParent !== null;
    const grids = [...document.querySelectorAll<HTMLElement>('main > section.grid')].map(
      (s) => {
        const lb = s.getAttribute('aria-labelledby');
        const head = lb ? document.getElementById(lb) : null;
        return {
          testid: s.dataset.testid ?? null,
          ariaLabelOnly: !lb && !!s.getAttribute('aria-label'),
          labelledbyResolves: !!head && isVisible(head) && head.textContent!.trim().length > 0,
          headText: head?.textContent?.trim() ?? null,
        };
      },
    );
    const sectionHeads = [...document.querySelectorAll<HTMLElement>('.section-head')].map(
      (h) => ({
        text: h.textContent!.trim(),
        primary: h.classList.contains('section-head--primary'),
        weight: Number(getComputedStyle(h).fontWeight),
        visible: isVisible(h),
      }),
    );
    return { grids, sectionHeads };
  });

  // Every specimen grid is labelled by a real, visible heading — never aria-label only.
  expect(ia.grids.length).toBeGreaterThanOrEqual(3);
  for (const g of ia.grids) {
    expect(g.ariaLabelOnly, `${g.testid} must not be labelled by aria-label only`).toBe(false);
    expect(g.labelledbyResolves, `${g.testid} aria-labelledby must resolve to a visible heading`).toBe(
      true,
    );
  }

  // The primary ladder leads: first section heading is the primary, it is visible,
  // and it carries at least as much weight as every derived heading.
  expect(ia.sectionHeads.length).toBeGreaterThanOrEqual(3);
  const first = ia.sectionHeads[0];
  expect(first, 'there must be at least one specimen heading').toBeDefined();
  if (!first) throw new Error('no specimen heading');
  expect(first.primary, 'the first specimen heading must be the primary (size) ladder').toBe(true);
  expect(first.visible).toBe(true);
  const derived = ia.sectionHeads.filter((h) => !h.primary);
  expect(derived.length).toBeGreaterThanOrEqual(2);
  for (const d of derived) {
    expect(d.visible, `derived heading "${d.text}" must be visible`).toBe(true);
    expect(
      first.weight,
      `primary heading weight ${first.weight} must be ≥ derived "${d.text}" weight ${d.weight}`,
    ).toBeGreaterThanOrEqual(d.weight);
  }
});
