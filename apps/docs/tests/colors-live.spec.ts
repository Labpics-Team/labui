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

test('inline роль проходит через Program, сохраняет бренд и возвращает alias после удаления', async ({
  page,
}) => {
  await fixture(page);
  const before = await page.evaluate(() => window.__labColorsLive?.read('root'));
  if (!before) throw new Error('Нет исходного результата');
  await page.locator('#colors-root').evaluate((scope) => {
    (scope as HTMLElement).style.setProperty('--lab-fill-accent', 'rgb(1, 2, 3)');
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__labColorsLive?.read('root').properties['--lab-fill-accent']),
    )
    .toBe('rgb(1 2 3)');
  const changed = await page.evaluate(() => window.__labColorsLive?.read('root'));
  if (!changed) throw new Error('Нет пересчитанного результата');
  expect(changed.state).toBe('ready');
  expect(changed.populated).toBe(changed.propertyCount);
  expect(changed.outputCount).toBeGreaterThan(before.outputCount ?? 0);
  for (const name of [
    '--lab-badge-fill-brand',
    '--lab-fill-brand-primary',
    '--lab-label-brand-primary',
    '--lab-border-brand-strong',
  ]) {
    expect(changed.properties[name]).toBe(before.properties[name]);
  }
  const repeated = await page.evaluate(() => window.__labColorsLive?.refresh('root'));
  expect(repeated?.revision).toBe(changed.revision);
  expect(repeated?.snapshotVersion).toBe(changed.snapshotVersion);
  await page.locator('#colors-root').evaluate((scope) => {
    (scope as HTMLElement).style.setProperty('--lab-fill-accent', 'rgb(10 20 30 / 0.5)');
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__labColorsLive?.read('root').properties['--lab-fill-accent']),
    )
    .toBe('rgb(10 20 30 / 0.5)');
  const actual = await page.locator('#colors-root').evaluate((scope) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--lab-fill-accent)';
    scope.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  expect(actual).toBe('rgba(10, 20, 30, 0.5)');
  for (const value of [
    '#123',
    '#1238',
    '#0A141E',
    '#0A141E80',
    'rgba(10, 20, 30, 0.5)',
    'rgb(10 20 30 / 50%)',
    'transparent',
  ]) {
    await page.locator('#colors-root').evaluate((scope, value) => {
      (scope as HTMLElement).style.setProperty('--lab-fill-accent', value);
    }, value);
    const committed = await page.evaluate(() => window.__labColorsLive?.refresh('root'));
    expect(committed?.state).toBe('ready');
    const compared = await page.locator('#colors-root').evaluate((scope, value) => {
      const actual = document.createElement('span');
      const reference = document.createElement('span');
      actual.style.color = 'var(--lab-fill-accent)';
      reference.style.color = value;
      scope.append(actual, reference);
      const result = {
        actual: getComputedStyle(actual).color,
        expected: getComputedStyle(reference).color,
      };
      actual.remove();
      reference.remove();
      return result;
    }, value);
    expect(compared.actual, value).toBe(compared.expected);
  }
  await page.locator('#colors-root').evaluate((scope) => {
    (scope as HTMLElement).style.removeProperty('--lab-fill-accent');
  });
  await expect
    .poll(() => page.evaluate(() => window.__labColorsLive?.read('root').properties))
    .toEqual(before.properties);
  expect(await page.evaluate(() => window.__labColorsLive?.partialFrames)).toEqual([]);
});

test('неподдержанный inline !important отзывает подтверждение и допускает восстановление', async ({
  page,
}) => {
  await fixture(page);
  await page.locator('#colors-root').evaluate((scope) => {
    (scope as HTMLElement).style.setProperty('--lab-label-primary', 'rgb(1 2 3)', 'important');
  });
  await expect(page.locator('#colors-root')).toHaveAttribute('data-lab-colors-state', 'failed');
  const refused = await page.evaluate(() => window.__labColorsLive?.refresh('root'));
  expect(refused?.state).toBe('failed');
  expect(refused?.reason).toBe('unsupported_role_override');
  expect(refused?.revision).toBeNull();
  await page.locator('#colors-root').evaluate((scope) => {
    (scope as HTMLElement).style.removeProperty('--lab-label-primary');
  });
  await expect(page.locator('#colors-root')).toHaveAttribute('data-lab-colors-state', 'ready');
  const restored = await page.evaluate(() => window.__labColorsLive?.read('root'));
  expect(restored?.populated).toBe(restored?.propertyCount);
});

test('more: override единственной computed краски даёт готовую fixed тему и восстанавливается', async ({
  page,
}) => {
  await fixture(page);
  await page
    .locator('#colors-root')
    .evaluate((scope) => scope.setAttribute('data-contrast', 'more'));
  const adaptive = await page.evaluate(() => window.__labColorsLive?.refresh('root'));
  if (!adaptive) throw new Error('Нет результата повышенного контраста');
  expect(adaptive.state).toBe('ready');
  await page.locator('#colors-root').evaluate((scope) => {
    (scope as HTMLElement).style.setProperty('--lab-badge-fill-brand', 'rgb(1, 2, 3)');
  });
  const fixed = await page.evaluate(() => window.__labColorsLive?.refresh('root'));
  if (!fixed) throw new Error('Нет fixed результата');
  expect(fixed.state).toBe('ready');
  expect(fixed.properties['--lab-badge-fill-brand']).toBe('rgb(1 2 3)');
  expect(fixed.properties['--lab-fill-accent']).toBe('rgb(1 2 3)');
  expect(fixed.properties['--lab-label-brand-primary']).toBe(
    adaptive.properties['--lab-label-brand-primary'],
  );
  expect(fixed.populated).toBe(fixed.propertyCount);
  const replay = await page.evaluate(() => window.__labColorsLive?.refresh('root'));
  expect(replay?.revision).toBe(fixed.revision);
  expect(replay?.snapshotVersion).toBe(fixed.snapshotVersion);
  await page.locator('#colors-root').evaluate((scope) => {
    (scope as HTMLElement).style.removeProperty('--lab-badge-fill-brand');
  });
  const restored = await page.evaluate(() => window.__labColorsLive?.refresh('root'));
  expect(restored?.state).toBe('ready');
  expect(restored?.properties).toEqual(adaptive.properties);
});

test('неподдержанное CSS-выражение не становится произвольной краской', async ({ page }) => {
  await fixture(page);
  await page.locator('#colors-root').evaluate((scope) => {
    (scope as HTMLElement).style.setProperty('--lab-fill-accent', 'color(display-p3 1 0 0)');
  });
  await expect(page.locator('#colors-root')).toHaveAttribute('data-lab-colors-state', 'failed');
  const refused = await page.evaluate(() => window.__labColorsLive?.read('root'));
  expect(refused?.reason).toBe('unsupported_role_override');
  expect(refused?.populated).toBe(0);
  await page.locator('#colors-root').evaluate((scope) => {
    (scope as HTMLElement).style.removeProperty('--lab-fill-accent');
  });
  await expect(page.locator('#colors-root')).toHaveAttribute('data-lab-colors-state', 'ready');
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

test('вложенная публикация из DOM listener не доставляет прежний Ready в callback приложения', async ({
  page,
}) => {
  await fixture(page);
  const cases = [
    ['listener', 'cancel'],
    ['listener', 'dispose'],
    ['callback', 'cancel'],
    ['callback', 'dispose'],
    ['listener', 'none'],
  ] as const;
  for (const [origin, action] of cases) {
    const result = await page.evaluate(
      ({ origin, action }) => window.__labColorsLive?.probePublisherReentry(origin, action),
      { origin, action },
    );
    if (!result) throw new Error('Нет результата browser publisher');
    const terminal = action === 'none' ? 'ready' : action === 'cancel' ? 'cancelled' : 'disposed';
    expect(result.ready).toBe('ready');
    expect(result.state).toBe(terminal);
    expect(result.attribute).toBe(terminal);
    expect(result.events).toEqual(action === 'none' ? ['ready'] : ['ready', terminal]);
    expect(result.callbacks).toEqual(origin === 'callback' ? ['ready', terminal] : [terminal]);
  }
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
