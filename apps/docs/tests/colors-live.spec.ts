import { type Page, expect, test } from '@playwright/test';

async function fixture(page: Page) {
  await page.goto('/_fixtures/colors-live.html');
  await page.evaluate(async () => {
    const fixture = window.__labColorsLive;
    if (!fixture) throw new Error('Живой потребитель не загрузился');
    await fixture.ready;
  });
  for (const id of ['colors-root', 'colors-nested', 'colors-shadow']) {
    await expect(page.locator(`#${id}`)).toHaveAttribute('data-lab-colors-state', 'ready');
  }
}

test('обычные страницы запускают живой Core runtime и сохраняют авторскую alpha', async ({
  page,
}) => {
  for (const path of ['/button.html', '/components.html?component=button']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-lab-colors-state', 'ready');
    const actual = await page.locator('html').evaluate((scope) => {
      const reference = document.createElement('span');
      reference.style.color = 'rgb(255 255 255 / 0.722)';
      document.body.append(reference);
      const expected = getComputedStyle(reference).color;
      reference.style.color = 'var(--lab-label-static-light-secondary)';
      const color = getComputedStyle(reference).color;
      reference.remove();
      return { color, expected, state: scope.getAttribute('data-lab-colors-state') };
    });
    expect(actual.color).toBe(actual.expected);
    expect(actual.state).toBe('ready');
    const primary = await page.locator('html').evaluate((scope) => {
      const before = getComputedStyle(scope).getPropertyValue('--lab-label-primary');
      scope.setAttribute(
        'data-theme',
        scope.getAttribute('data-theme') === 'light' ? 'dark' : 'light',
      );
      return before;
    });
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate(
            (scope, previous) =>
              getComputedStyle(scope).getPropertyValue('--lab-label-primary') || previous,
            primary,
          ),
      )
      .not.toBe(primary);
    const more = await page.locator('html').evaluate(
      (scope) =>
        new Promise<{ state: string; contrast: string }>((resolve) => {
          const listener = (event: Event) => {
            const state = (event as CustomEvent).detail;
            if (
              state.contrast !== 'more' &&
              !['failed', 'stale', 'cancelled', 'disposed'].includes(state.state)
            )
              return;
            scope.removeEventListener('lab-colors-state', listener);
            resolve({ state: state.state, contrast: state.contrast ?? 'unknown' });
          };
          scope.addEventListener('lab-colors-state', listener);
          scope.setAttribute('data-contrast', 'more');
        }),
    );
    expect(more).toEqual({ state: 'ready', contrast: 'more' });
  }
});

test('живой полный scope: измеряется только корректно committed результат', async ({
  page,
  browser,
}, testInfo) => {
  await fixture(page);
  const measured = await page.evaluate(async () => {
    const fixture = window.__labColorsLive;
    if (!fixture) throw new Error('Нет живого потребителя');
    const updates = await fixture.measureRoot(16);
    return { initialBootMs: fixture.initialBootMs, ...updates };
  });
  expect(measured.elapsedMs).toHaveLength(16);
  expect(Number.isFinite(measured.initialBootMs.root)).toBe(true);
  expect(measured.initialBootMs.root).toBeGreaterThanOrEqual(0);
  expect(measured.outputCount).toBeGreaterThan(0);
  const sorted = [...measured.elapsedMs].sort((a, b) => a - b);
  const lowerMedian = sorted.at(sorted.length / 2 - 1);
  const upperMedian = sorted.at(sorted.length / 2);
  const p95 = sorted.at(Math.ceil(sorted.length * 0.95) - 1);
  if (lowerMedian === undefined || upperMedian === undefined || p95 === undefined) {
    throw new Error('Нет полного измерения latency');
  }
  await testInfo.attach('live-colors-latency', {
    body: JSON.stringify(
      {
        browser: browser.version(),
        project: testInfo.project.name,
        bootBoundary: 'attach → first ready',
        updateBoundary: 'DOM backdrop change → ready event after host ACK',
        quantiles: 'median; p95 nearest rank',
        ...measured,
        medianMs: (lowerMedian + upperMedian) / 2,
        p95Ms: p95,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(await page.evaluate(() => window.__labColorsLive?.partialFrames)).toEqual([]);
});

test('смена независимого фона пересчитывает composites и сохраняет locked краски', async ({
  page,
}) => {
  await fixture(page);
  const before = await page.evaluate(() => window.__labColorsLive?.read('root'));
  if (!before) throw new Error('Нет исходного результата');
  await page.locator('#root-backdrop').evaluate((backdrop) => {
    (backdrop as HTMLElement).style.backgroundColor = 'rgb(0 0 0)';
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__labColorsLive?.read('root').properties['--lab-bg-tone-2']),
    )
    .not.toBe(before.properties['--lab-bg-tone-2']);
  const after = await page.evaluate(() => window.__labColorsLive?.read('root'));
  if (!after) throw new Error('Нет пересчитанного результата');
  expect(after.state).toBe('ready');
  expect(after.populated).toBe(after.propertyCount);
  for (const name of [
    '--lab-bg-tone-1',
    '--lab-fill-brand-primary',
    '--lab-label-static-light-secondary',
  ]) {
    expect(after.properties[name]).toBe(before.properties[name]);
  }
  const replay = await page.evaluate(() => window.__labColorsLive?.refresh('root'));
  expect(replay?.revision).toBe(after.revision);
  expect(replay?.snapshotVersion).toBe(after.snapshotVersion);
  expect(replay?.properties).toEqual(after.properties);
});

test('initial mask, unsupported фон, cancel и восстановление охватывают всю тему', async ({
  page,
}) => {
  await fixture(page);
  const initial = await page.evaluate(() => window.__labColorsLive?.initial);
  expect(Object.values(initial ?? {}).map((snapshot) => snapshot.populated)).toEqual([0, 0, 0]);
  for (const background of ['linear-gradient(white, black)', 'rgb(255 255 255 / 0.5)']) {
    await page.locator('#root-backdrop').evaluate((backdrop, background) => {
      (backdrop as HTMLElement).style.background = background;
    }, background);
    await expect(page.locator('#colors-root')).toHaveAttribute('data-lab-colors-state', 'stale');
    expect(await page.evaluate(() => window.__labColorsLive?.read('root').populated)).toBe(0);
    await page.locator('#root-backdrop').evaluate((backdrop) => {
      (backdrop as HTMLElement).style.background = 'rgb(255 255 255)';
    });
    await expect(page.locator('#colors-root')).toHaveAttribute('data-lab-colors-state', 'ready');
  }
  const cancelled = await page.evaluate(() => window.__labColorsLive?.cancel('root'));
  expect(cancelled?.state).toBe('cancelled');
  expect(cancelled?.populated).toBe(0);
  const restored = await page.evaluate(() => window.__labColorsLive?.refresh('root'));
  expect(restored?.state).toBe('ready');
  expect(restored?.populated).toBe(restored?.propertyCount);
  const disposed = await page.evaluate(() => window.__labColorsLive?.dispose('root'));
  expect(disposed?.state).toBe('disposed');
  await expect(page.locator('#colors-root')).not.toHaveAttribute('data-lab-colors-scope');
  const remounted = await page.evaluate(() => window.__labColorsLive?.mount('root'));
  expect(remounted?.state).toBe('ready');
  expect(remounted?.populated).toBe(remounted?.propertyCount);
});

test('observe cancel/dispose сохраняют terminal и допускают новое полное подключение', async ({
  page,
}) => {
  await fixture(page);
  for (const action of ['cancel', 'dispose'] as const) {
    const result = await page.evaluate(
      (action) => window.__labColorsLive?.probeLifecycle(action),
      action,
    );
    if (!result) throw new Error('Нет результата lifecycle');
    const terminal = action === 'cancel' ? 'cancelled' : 'disposed';
    expect(result.stopped).toBe(terminal);
    expect(result.states).toEqual([terminal]);
    expect(result.hasScope).toBe(action === 'cancel');
    if (action === 'cancel') expect(result.masked).toBe(true);
    expect(result.restored).toBe('ready');
    const expected = await page.evaluate(() => window.__labColorsLive?.read('root').propertyCount);
    expect(result.populated).toBe(expected);
  }
});

test('один кадр black достигает живого Core и неизменный фон не публикуется повторно', async ({
  page,
}) => {
  await fixture(page);
  const result = await page.evaluate(() => window.__labColorsLive?.probeFrameSampling());
  if (!result) throw new Error('Нет результата frame sampling');
  expect(result.commits).toHaveLength(2);
  expect(result.commits[0]?.tone).not.toBe(result.initial);
  expect(result.commits[1]?.tone).toBe(result.initial);
  expect(result.commits.map(({ populated }) => populated)).toEqual([
    result.propertyCount,
    result.propertyCount,
  ]);
  expect(result.stableCommits).toBe(0);
});

test('вложенные области, ShadowRoot, selection и повреждённый слой сохраняют свой контекст', async ({
  page,
}) => {
  await fixture(page);
  const initial = await page.evaluate(() => ({
    root: window.__labColorsLive?.read('root'),
    nested: window.__labColorsLive?.read('nested'),
    shadow: window.__labColorsLive?.read('shadow'),
  }));
  expect(initial.nested?.properties['--lab-label-primary']).toBe(
    initial.shadow?.properties['--lab-label-primary'],
  );
  expect(initial.root?.properties['--lab-label-primary']).not.toBe(
    initial.nested?.properties['--lab-label-primary'],
  );
  const selection = await page.locator('#colors-nested h2').evaluate((element) => {
    const selection = getComputedStyle(element, '::selection');
    const reference = document.createElement('span');
    reference.style.color = 'var(--lab-label-on-accent)';
    reference.style.background = 'var(--lab-fill-accent)';
    element.append(reference);
    const expected = getComputedStyle(reference);
    const result = {
      color: selection.color,
      background: selection.backgroundColor,
      expectedColor: expected.color,
      expectedBackground: expected.backgroundColor,
    };
    reference.remove();
    return result;
  });
  expect(selection.color).toBe(selection.expectedColor);
  expect(selection.background).toBe(selection.expectedBackground);
  const recovered = await page.evaluate(async () => {
    window.__labColorsLive?.damage('root');
    return window.__labColorsLive?.refresh('root');
  });
  expect(recovered?.state).toBe('ready');
  expect(recovered?.properties).toEqual(initial.root?.properties);
  await page
    .locator('#colors-shadow-host')
    .evaluate((host) => host.setAttribute('data-theme', 'light'));
  await expect
    .poll(() =>
      page.evaluate(() => window.__labColorsLive?.read('shadow').properties['--lab-label-primary']),
    )
    .toBe(initial.root?.properties['--lab-label-primary']);
  expect(await page.evaluate(() => window.__labColorsLive?.partialFrames)).toEqual([]);
});
