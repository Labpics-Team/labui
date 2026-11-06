import { expect, test } from '@playwright/test';

// Это существующий browser host и public refresh, не отдельная модель solver.
for (const refusal of [
  { property: '--lab-badge-fill-brand', state: 'failed' },
  { property: '--lab-label-accent', state: 'unsatisfied' },
] as const) {
  test(`more: ${refusal.state} отзыв и восстановление не меняют независимо scoped descendants`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/_fixtures/colors-live.html');
    await page.evaluate(async () => {
      const fixture = window.__labColorsLive;
      if (!fixture) throw new Error('Живой потребитель не загрузился');
      await fixture.ready;
    });
    const evidence = await page.evaluate(async (property) => {
      const fixture = window.__labColorsLive;
      const scope = document.querySelector<HTMLElement>('#colors-root');
      const nested = document.querySelector<HTMLElement>('#colors-nested');
      const shadow = document
        .querySelector('#colors-shadow-host')
        ?.shadowRoot?.querySelector<HTMLElement>('#colors-shadow');
      if (!fixture || !scope || !nested || !shadow) throw new Error('Нет реальных attachments');
      const descendants = [
        { key: 'nested', scope: nested },
        { key: 'shadow', scope: shadow },
      ] as const;
      const previous = descendants.map(({ scope }) => scope.getAttribute('data-contrast'));
      const rootContrast = scope.getAttribute('data-contrast');
      const readDescendants = () => ({
        nested: fixture.read('nested'),
        shadow: fixture.read('shadow'),
      });
      try {
        // Это настоящие DOM/ShadowRoot descendants, не siblings. Явный normal
        // отделяет их вход контраста от root до фиксации baseline.
        for (const descendant of descendants) {
          descendant.scope.setAttribute('data-contrast', 'normal');
          const settled = await fixture.refresh(descendant.key);
          if (settled.state !== 'ready') throw new Error(`${descendant.key}: ${settled.state}`);
        }
        const descendantBefore = readDescendants();
        scope.setAttribute('data-contrast', 'more');
        const ready = await fixture.refresh('root');
        if (ready.state !== 'ready') throw new Error(`Исходный more: ${ready.state}`);
        // Fixed fill удаляет последний computed target: V1 conflict → Failed.
        // Fixed accent-label сохраняет computed fill: V3 infeasible → Unsatisfied.
        // Оба пути обязаны полностью отозвать только собственные managed роли.
        scope.style.setProperty(property, 'rgb(255 255 255)');
        const refused = await fixture.refresh('root');
        const descendantRefused = readDescendants();
        scope.style.removeProperty(property);
        const restored = await fixture.refresh('root');
        return {
          ready,
          refused,
          restored,
          descendantBefore,
          descendantRefused,
          descendantRestored: readDescendants(),
          partialFrames: [...fixture.partialFrames],
        };
      } finally {
        scope.style.removeProperty(property);
        if (rootContrast === null) scope.removeAttribute('data-contrast');
        else scope.setAttribute('data-contrast', rootContrast);
        await fixture.refresh('root');
        for (const [index, descendant] of descendants.entries()) {
          const contrast = previous[index];
          if (contrast === null) descendant.scope.removeAttribute('data-contrast');
          else if (contrast !== undefined) descendant.scope.setAttribute('data-contrast', contrast);
          await fixture.refresh(descendant.key);
        }
      }
    }, refusal.property);
    expect(evidence.ready.snapshotVersion).toBe(2);
    expect(evidence.ready.populated).toBe(evidence.ready.propertyCount);
    expect(evidence.refused.state).toBe(refusal.state);
    expect(evidence.refused.outputCount).toBe(0);
    expect(evidence.refused.populated).toBe(0);
    expect(Object.values(evidence.refused.properties).every((value) => value === '')).toBe(true);
    expect(evidence.descendantRefused).toEqual(evidence.descendantBefore);
    expect(evidence.restored.state).toBe('ready');
    expect(evidence.restored.snapshotVersion).toBe(2);
    expect(evidence.restored.populated).toBe(evidence.ready.propertyCount);
    expect(evidence.restored.properties).toEqual(evidence.ready.properties);
    expect(evidence.descendantRestored).toEqual(evidence.descendantBefore);
    expect(evidence.partialFrames).toEqual([]);
  });
}

test('Lit Button: настоящий pointer/Enter/Space дают trusted composed activation', async ({
  page,
}) => {
  await page.goto('/button.html');
  await expect(page.locator('html')).toHaveAttribute('data-lab-colors-state', 'ready');
  const host = page.getByTestId('lit-accent-fill');
  const button = host.getByRole('button');
  await button.waitFor();
  // Подписка предшествует действиям. Атрибуты принадлежат только наблюдению
  // теста; компонент и его нативная activation не заменяются.
  await host.evaluate((element) => {
    let count = 0;
    const events: Array<{ trusted: boolean; composed: boolean }> = [];
    element.addEventListener('click', (event) => {
      events.push({ trusted: event.isTrusted, composed: event.composed });
      element.setAttribute('data-observed-clicks', String(++count));
      element.setAttribute('data-observed-events', JSON.stringify(events));
    });
  });
  await button.click();
  await expect(host).toHaveAttribute('data-observed-clicks', '1');
  await button.focus();
  await button.press('Enter');
  await expect(host).toHaveAttribute('data-observed-clicks', '2');
  await button.press('Space');
  await expect(host).toHaveAttribute('data-observed-clicks', '3');
  const events = await host.evaluate((element) =>
    JSON.parse(element.getAttribute('data-observed-events') ?? 'null'),
  );
  expect(events).toEqual([
    { trusted: true, composed: true },
    { trusted: true, composed: true },
    { trusted: true, composed: true },
  ]);
});
