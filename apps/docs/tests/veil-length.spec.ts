import { type Page, expect, test } from '@playwright/test';

async function load(page: Page, css?: string): Promise<void> {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(`/_fixtures/veil-length.html${css ? `?css=${encodeURIComponent(css)}` : ''}`);
  await page.waitForFunction(() => !!window.__veilLength);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }),
  );
}

async function strength(page: Page, expected: number): Promise<void> {
  await expect
    .poll(async () => {
      const actual = await page.evaluate(() => window.__veilLength.snapshot().strength);
      return Math.abs(actual - expected);
    })
    .toBeLessThanOrEqual(0.02);
}

async function disableLengthCSS(
  page: Page,
  missing: 'registration' | 'queries' | 'both',
): Promise<void> {
  await page.addInitScript((capability) => {
    const observed = { capability, sheets: 0, removed: 0, properties: 0, queries: 0, remaining: 0 };
    Object.defineProperty(window, '__veilCSSDouble', { value: observed });
    if (capability === 'registration' || capability === 'both') {
      Object.defineProperty(CSS, 'registerProperty', { configurable: true, value: undefined });
    }
    const appendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function <T extends Node>(node: T): T {
      const result = appendChild.call(this, node) as T;
      if (
        node instanceof HTMLStyleElement &&
        node.classList.contains('lab-material__length-types')
      ) {
        const sheet = node.sheet;
        if (!sheet) throw new Error('Нет исполняемой таблицы CSS-длин');
        for (let index = sheet.cssRules.length - 1; index >= 0; index--) {
          const current = sheet.cssRules.item(index);
          if (!current) throw new Error('Правило CSS-длин исчезло');
          const rule = current.cssText;
          if (
            (capability === 'registration' || capability === 'both') &&
            /^@property\b/.test(rule)
          ) {
            sheet.deleteRule(index);
            observed.properties++;
            observed.removed++;
          } else if (
            (capability === 'queries' || capability === 'both') &&
            /^@container\b/.test(rule)
          ) {
            sheet.deleteRule(index);
            observed.queries++;
            observed.removed++;
          }
        }
        observed.remaining += [...sheet.cssRules].filter(
          (current) =>
            ((capability === 'registration' || capability === 'both') &&
              /^@property\b/.test(current.cssText)) ||
            ((capability === 'queries' || capability === 'both') &&
              /^@container\b/.test(current.cssText)),
        ).length;
        observed.sheets++;
      }
      return result;
    };
  }, missing);
}

for (const context of [
  { kind: 'upgrade', owner: 'document', materialClass: false },
  { kind: 'defined', owner: 'document', materialClass: false },
  { kind: 'upgrade', owner: 'surface', materialClass: false },
  { kind: 'defined', owner: 'document', materialClass: true },
] as const) {
  for (const missing of ['healthy', 'both'] as const) {
    test(`поздний render передаёт slot scope: ${context.kind}, ${context.owner}, class=${context.materialClass}, ${missing}`, async ({
      page,
    }, info) => {
      if (missing !== 'healthy') await disableLengthCSS(page, missing);
      await load(page, '.scope{--lab-veil-strength:0px}');
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.evaluate(
        ({ kind, owner, materialClass }) =>
          window.__veilLength.startLateSlot(kind, 'assigned', owner, materialClass),
        context,
      );
      const read = () => page.evaluate(() => window.__veilLength.lateSlotSnapshot());
      const radius = async (expected: number) => {
        await expect
          .poll(async () => Math.abs((await read()).strength - expected))
          .toBeLessThanOrEqual(0.02);
      };
      await radius(20);
      const initial = await read();
      expect(initial).toMatchObject({ native: 'blur(20px)', box: [200, 200] });
      await settle(page);
      await page.evaluate(() => window.__veilLength.renderLateSlot());
      await radius(32);
      const rendered = await read();
      expect(rendered).toMatchObject({ native: 'blur(32px)', box: [200, 200] });
      expect(rendered.order.indexOf('scoped-mounted')).toBeGreaterThan(
        rendered.order.indexOf('render-complete'),
      );
      if (context.kind === 'defined') expect(initial.order[0]).toBe('definition-complete');
      await page.evaluate(() => window.__veilLength.overlapLateSlot());
      await settle(page);
      const overlap = await read();
      expect(overlap.count).toBe(rendered.count);
      expect(overlap.children).toBe(rendered.children);
      expect(overlap.types).toBe(rendered.types);
      await page.evaluate(() => {
        window.__veilLength.releaseLateSlot('overlap');
        window.__veilLength.releaseLateSlot('component');
        window.__veilLength.lateSlotClass('strong');
      });
      await radius(48);
      const remaining = await read();
      expect(remaining).toMatchObject({ native: 'blur(48px)', box: [200, 200] });
      await page.evaluate(() => window.__veilLength.releaseLateSlot('all'));
      await settle(page);
      const disposed = await read();
      expect(disposed).toMatchObject({ count: 0, children: 0, types: 0, rootTypes: 0 });
      await page.evaluate(() => window.__veilLength.lateSlotClass('invalid'));
      await settle(page);
      expect((await read()).count).toBe(0);
      expect(errors).toEqual([]);
      await info.attach('late-render-lifecycle.json', {
        body: JSON.stringify({ initial, rendered, overlap, remaining, disposed, errors }),
        contentType: 'application/json',
      });
    });
  }
}

for (const topology of ['assigned', 'descendant', 'nested', 'fallback', 'slot'] as const) {
  for (const missing of ['healthy', 'both'] as const) {
    test(`slot scope владеет поверхностями и наблюдением: ${topology}, ${missing}`, async ({
      page,
    }, info) => {
      if (missing !== 'healthy') await disableLengthCSS(page, missing);
      await load(page, '.scope{--lab-veil-strength:0px}');
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.evaluate((value) => {
        window.__veilLength.startLateSlot('defined', value, 'none');
        window.__veilLength.renderLateSlot();
      }, topology);
      const read = () => page.evaluate(() => window.__veilLength.lateSlotSnapshot());
      const radius = async (expected: number) => {
        await expect
          .poll(async () => Math.abs((await read()).strength - expected))
          .toBeLessThanOrEqual(0.02);
      };
      await radius(32);
      const rendered = await read();
      expect(rendered).toMatchObject({ native: 'blur(32px)', box: [200, 200], privateCount: 0 });
      if (topology === 'nested') {
        expect(rendered).toMatchObject({ privateBox: [200, 200], privateNative: 'blur(32px)' });
        await page.evaluate(() => window.__veilLength.overlapLateSlot('nested'));
        await expect.poll(async () => (await read()).privateCount).toBeGreaterThan(0);
        await page.evaluate(() => window.__veilLength.releaseLateSlot('overlap'));
        await expect.poll(async () => (await read()).privateCount).toBe(0);
        await radius(32);
      }
      await page.evaluate(() => window.__veilLength.lateSlotClass('strong'));
      await radius(48);
      await page.evaluate(() => window.__veilLength.lateSlotClass('invalid'));
      await radius(0);
      expect((await read()).count).toBe(0);
      await expect
        .poll(() => errors.some((message) => message.includes('--lab-veil-feather')))
        .toBe(true);
      await page.evaluate(() => window.__veilLength.lateSlotClass(''));
      await radius(32);
      // После ухода последней поверхности назначенный контейнер всё ещё scope:
      // его новые потомки и их атрибуты не дают slotchange.
      await page.evaluate(() => window.__veilLength.lateSlotEnable(false));
      await radius(0);
      expect((await read()).count).toBe(0);
      if (topology === 'descendant') {
        await page.evaluate(() => window.__veilLength.lateSlotReplace());
      } else {
        await page.evaluate(() => window.__veilLength.lateSlotEnable(true));
      }
      await radius(32);
      const recovered = await read();
      expect(recovered.privateCount).toBe(0);
      await page.evaluate(() => window.__veilLength.lateSlotConnect(false));
      await settle(page);
      expect(await read()).toMatchObject({ count: 0, children: 0, types: 0, rootTypes: 0 });
      await page.evaluate(() => window.__veilLength.lateSlotConnect(true));
      await radius(32);
      const reconnected = await read();
      expect(reconnected.privateCount).toBe(0);
      const errorCount = errors.length;
      await page.evaluate(() => {
        window.__veilLength.releaseLateSlot('all');
        window.__veilLength.lateSlotClass('invalid');
      });
      await settle(page);
      const disposed = await read();
      expect(disposed).toMatchObject({ count: 0, children: 0, types: 0, rootTypes: 0 });
      expect(errors).toHaveLength(errorCount);
      await info.attach('slot-owner-lifecycle.json', {
        body: JSON.stringify({ rendered, recovered, reconnected, disposed, errors }),
        contentType: 'application/json',
      });
    });
  }
}

for (const context of [
  { name: 'без registration', missing: 'registration', appLevel: true, materialClass: false },
  { name: 'без queries', missing: 'queries', appLevel: true, materialClass: false },
  { name: 'без обеих возможностей', missing: 'both', appLevel: true, materialClass: false },
  { name: 'полный CSS', missing: 'healthy', appLevel: true, materialClass: false },
  { name: 'контроль .lab-material', missing: 'both', appLevel: true, materialClass: true },
  { name: 'контроль прямого mount', missing: 'both', appLevel: false, materialClass: false },
] as const) {
  for (const transition of ['class', 'name', 'feather'] as const) {
    test(`доступный контекст slotted veil: ${context.name}, ${transition}`, async ({
      page,
    }, info) => {
      if (context.missing !== 'healthy') await disableLengthCSS(page, context.missing);
      await load(page, '.scope{--lab-veil-strength:0px}');
      await page.evaluate(
        ({ appLevel, materialClass }) => window.__veilLength.startSlot(appLevel, materialClass),
        context,
      );
      const read = () => page.evaluate(() => window.__veilLength.slotSnapshot());
      const radius = async (expected: number) => {
        await expect
          .poll(async () => Math.abs((await read()).strength - expected))
          .toBeLessThanOrEqual(0.02);
      };
      await radius(32);
      const before = await read();
      expect(before).toMatchObject({ native: 'blur(32px)', box: [200, 200], slotContext: 'first' });
      expect(before.count).toBeGreaterThan(0);
      const double = await page.evaluate(() => Reflect.get(window, '__veilCSSDouble'));
      if (context.missing !== 'healthy') {
        expect(double.sheets).toBeGreaterThan(0);
        if (context.missing !== 'queries') expect(double.properties).toBeGreaterThanOrEqual(4);
        if (context.missing !== 'registration') expect(double.queries).toBeGreaterThanOrEqual(4);
      }
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.evaluate((change) => {
        if (change === 'name') window.__veilLength.slotRename();
        else window.__veilLength.slotClass(change === 'class' ? 'alt' : 'invalid');
      }, transition);
      await settle(page);
      const after = await read();
      await info.attach('slot-transition.json', {
        body: JSON.stringify({ before, after, double, errors }),
        contentType: 'application/json',
      });
      expect(after.box).toEqual([200, 200]);
      expect(after.native).toBe(
        `blur(${transition === 'class' ? 48 : transition === 'name' ? 40 : 32}px)`,
      );
      if (transition === 'name') expect(after.slotContext).toBe('second');
      await radius(transition === 'class' ? 48 : transition === 'name' ? 40 : 0);
      if (transition === 'feather') {
        expect(after.count).toBe(0);
        await expect
          .poll(() => errors.some((message) => message.includes('--lab-veil-feather')))
          .toBe(true);
      } else {
        expect(after.count).toBeGreaterThan(0);
        expect(errors).toEqual([]);
      }
      await page.evaluate(() => {
        window.__veilLength.slotClass('');
        window.__veilLength.slotRename(true);
      });
      await radius(32);
      const recovered = await read();
      expect(recovered.count).toBeGreaterThan(0);
      expect(recovered.native).toBe('blur(32px)');
      await page.evaluate(() => window.__veilLength.disposeSlot());
      const errorCount = errors.length;
      await page.evaluate(() => {
        window.__veilLength.slotClass('invalid');
        window.__veilLength.slotRename();
      });
      await settle(page);
      const released = await read();
      expect(released).toMatchObject({ count: 0, children: 0, types: 0, box: [200, 200] });
      expect(errors).toHaveLength(errorCount);
      await info.attach('slot-lifecycle.json', {
        body: JSON.stringify({ recovered, released, errors }),
        contentType: 'application/json',
      });
    });
  }
}

test('rem и медиа меняют радиус при неизменном боксе поверхности', async ({ page }) => {
  await load(page);
  await strength(page, 24);
  await page.evaluate(() => window.__veilLength.font(32));
  await strength(page, 48);
  await page.setViewportSize({ width: 1200, height: 600 });
  await strength(page, 64);
});

test('px-числа прежнего API обновляются через тот же контекст', async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.__veilLength.strength('32'));
  await strength(page, 32);
  await page.evaluate(() => window.__veilLength.strength('40'));
  await strength(page, 40);
});

for (const value of ['0.0000001px', 'calc(1px / 10000000)', '1e-7']) {
  test(`допустимый радиус ${value} ниже порога не сообщает ошибку`, async ({ page }) => {
    await load(page);
    await strength(page, 24);
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.evaluate((input) => window.__veilLength.strength(input), value);
    await settle(page);
    expect(await page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.__veilLength.strength('24px'));
    await strength(page, 24);
  });
}

test('нечисловой legacy ввод не становится конечной длиной CSS', async ({ page }) => {
  await load(page);
  await strength(page, 24);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.evaluate(() => window.__veilLength.strength('1e309'));
  await settle(page);
  expect(await page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
  expect(errors.some((message) => message.includes('--lab-veil-strength'))).toBe(true);
});

test('media-смена default feather на ошибку снимает эффект и восстанавливает его', async ({
  page,
}, info) => {
  await load(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{--lab-veil-strength:24px;--lab-veil-feather:initial}@media(prefers-color-scheme:dark){.scope{--lab-veil-feather:50%}}',
    ),
  );
  await settle(page);
  await strength(page, 24);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const geometry = () =>
    page.evaluate(() => {
      const probe = document.querySelector('.lab-material__length--veil-feather');
      const box = probe?.getBoundingClientRect();
      return box ? [box.width, box.height] : null;
    });
  const before = await geometry();
  await page.emulateMedia({ colorScheme: 'dark' });
  await settle(page);
  await info.attach('feather-geometry.json', {
    body: JSON.stringify({ before, after: await geometry() }),
    contentType: 'application/json',
  });
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
  await expect
    .poll(() => errors.some((message) => message.includes('--lab-veil-feather')))
    .toBe(true);
  await page.emulateMedia({ colorScheme: 'light' });
  await strength(page, 24);
  expect(await page.evaluate(() => window.__veilLength.snapshot().box)).toEqual([200, 200]);
});

test('media-смена auto на ошибку feather снимает эффект и восстанавливает его', async ({
  page,
}) => {
  await load(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{--lab-veil-strength:24px;--lab-veil-feather:auto}@media(prefers-color-scheme:dark){.scope{--lab-veil-feather:50%}}',
    ),
  );
  await strength(page, 24);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
  await expect
    .poll(() => errors.some((message) => message.includes('--lab-veil-feather')))
    .toBe(true);
  await page.emulateMedia({ colorScheme: 'light' });
  await strength(page, 24);
  expect(await page.evaluate(() => window.__veilLength.snapshot().box)).toEqual([200, 200]);
  const auto = await page.evaluate(() => window.__veilLength.snapshot().masks);
  await page.evaluate(() => window.__veilLength.feather('8px'));
  await expect
    .poll(() => page.evaluate(() => window.__veilLength.snapshot().masks))
    .not.toEqual(auto);
  await page.evaluate(() => window.__veilLength.feather('auto'));
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().masks)).toEqual(auto);
});

for (const missing of ['registration', 'queries'] as const) {
  test(`прежние px-настройки сохраняются без ${missing}`, async ({ page }) => {
    await disableLengthCSS(page, missing);
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await load(page);
    await settle(page);
    expect(await page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
    expect(errors.some((message) => message.includes('измерение требует'))).toBe(true);
    errors.length = 0;
    for (const [input, expected] of [
      ['initial', 24],
      [' ', 24],
      ['24px', 24],
      ['-0px', 0],
      ['-0', 0],
      ['-0e0', 0],
      ['32', 32],
      ['32px', 32],
    ] as const) {
      await page.evaluate((value) => window.__veilLength.strength(value), input);
      await strength(page, expected);
    }
    await page.evaluate(() => window.__veilLength.feather('0px'));
    await settle(page);
    const zero = await page.evaluate(() => window.__veilLength.snapshot().masks);
    expect(zero.length).toBeGreaterThan(0);
    for (const value of ['-0px', '-0', '-0.0px', '-0e0']) {
      await page.evaluate((input) => window.__veilLength.feather(input), value);
      await strength(page, 32);
      await expect
        .poll(() => page.evaluate(() => window.__veilLength.snapshot().masks))
        .toEqual(zero);
    }
    await page.evaluate(() => window.__veilLength.feather('8px'));
    await settle(page);
    expect(await page.evaluate(() => window.__veilLength.snapshot().masks.length)).toBeGreaterThan(
      0,
    );
    expect(errors).toEqual([]);
    await page.evaluate(() => window.__veilLength.strength('0px'));
    await strength(page, 0);
    await page.evaluate(() => window.__veilLength.strength('50%'));
    await settle(page);
    expect(errors.some((message) => message.includes('--lab-veil-strength'))).toBe(true);
    expect(await page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
    await page.evaluate(() => window.__veilLength.strength('24px'));
    await strength(page, 24);
    await page.evaluate(() => window.__veilLength.dispose());
    expect(await page.evaluate(() => window.__veilLength.snapshot())).toMatchObject({
      count: 0,
      children: 0,
      types: 0,
    });
  });
}

for (const missing of ['registration', 'queries'] as const) {
  for (const history of [
    {
      name: 'px',
      before: '--lab-veil-strength:32px',
      after: '--lab-veil-strength:40px',
      initial: 32,
      final: 40,
    },
    {
      name: 'число',
      before: '--lab-veil-strength:32',
      after: '--lab-veil-strength:40',
      initial: 32,
      final: 40,
    },
    {
      name: 'пустой strength',
      before: '--lab-veil-strength: ',
      after: '--lab-veil-strength:50%',
      initial: 24,
      final: 0,
      error: '--lab-veil-strength',
    },
    {
      name: 'default feather',
      before: '--lab-veil-strength:24px;--lab-veil-feather:initial',
      after: '--lab-veil-feather:50%',
      initial: 24,
      final: 0,
      error: '--lab-veil-feather',
    },
    {
      name: 'auto feather',
      before: '--lab-veil-strength:24px;--lab-veil-feather:auto',
      after: '--lab-veil-feather:invalid',
      initial: 24,
      final: 0,
      error: '--lab-veil-feather',
    },
  ]) {
    test(`смена системной темы обновляет ${history.name} без ${missing}`, async ({ page }) => {
      await disableLengthCSS(page, missing);
      await page.emulateMedia({ colorScheme: 'light' });
      await load(
        page,
        `.scope{${history.before}}@media(prefers-color-scheme:dark){.scope{${history.after}}}`,
      );
      await strength(page, history.initial);
      const double = await page.evaluate(() => Reflect.get(window, '__veilCSSDouble'));
      // Other materials can add independent length properties to the shared
      // sheet. The double must remove every targeted rule, not a fixed total.
      expect(double).toMatchObject({ capability: missing, remaining: 0 });
      expect(double.removed).toBeGreaterThanOrEqual(4);
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.emulateMedia({ colorScheme: 'dark' });
      await strength(page, history.final);
      if (history.error) {
        await expect
          .poll(() => errors.some((message) => message.includes(history.error ?? '')))
          .toBe(true);
      } else {
        expect(errors).toEqual([]);
      }
      expect(await page.evaluate(() => window.__veilLength.snapshot().box)).toEqual([200, 200]);
      await page.emulateMedia({ colorScheme: 'light' });
      await strength(page, history.initial);
      await page.evaluate(() => window.__veilLength.dispose());
      await page.emulateMedia({ colorScheme: 'dark' });
      await settle(page);
      expect(await page.evaluate(() => window.__veilLength.snapshot())).toMatchObject({
        count: 0,
        children: 0,
        types: 0,
      });
    });
  }
}

test('отсутствующий и пустой токены сохраняют default, а media-смена пустого на ошибку наблюдаема', async ({
  page,
}) => {
  await load(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => window.__veilLength.css('.scope{--lab-veil-strength:initial}'));
  await settle(page);
  await strength(page, 24);
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{--lab-veil-strength: }@media(prefers-color-scheme:dark){.scope{--lab-veil-strength:invalid}}',
    ),
  );
  await settle(page);
  await strength(page, 24);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
  await expect
    .poll(() => errors.some((message) => message.includes('--lab-veil-strength')))
    .toBe(true);
  await page.emulateMedia({ colorScheme: 'light' });
  await strength(page, 24);
});

test('явный профиль не зависит от перекрытого strength', async ({ page }) => {
  await load(page);
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{--lab-veil-strength:auto;--lab-veil-stops:0 24px, 1 0px ease-out}',
    ),
  );
  await settle(page);
  await strength(page, 24);
  await page.evaluate(() => window.__veilLength.css('.scope{--lab-veil-strength:24px}'));
  await strength(page, 24);
});

test('container units вычисляются на поверхности, которая сама является контейнером', async ({
  page,
}) => {
  await load(page);
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{container-type:size;width:500px;height:500px;--lab-veil-strength:10cqw}.veil,.reference{container-type:size}',
    ),
  );
  expect(await page.evaluate(() => window.__veilLength.snapshot().native)).toBe('blur(50px)');
  await strength(page, 50);
  await page.evaluate(() => window.__veilLength.containerWidth(700));
  expect(await page.evaluate(() => window.__veilLength.snapshot().native)).toBe('blur(70px)');
  await strength(page, 70);
  expect(await page.evaluate(() => window.__veilLength.snapshot().box)).toEqual([200, 200]);
});

test('media меняет legacy число без изменения DOM и размеров поверхности', async ({ page }) => {
  await load(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{--lab-veil-strength:32}@media(prefers-color-scheme:dark){.scope{--lab-veil-strength:40}}',
    ),
  );
  await strength(page, 32);
  await page.emulateMedia({ colorScheme: 'dark' });
  await strength(page, 40);
  expect(await page.evaluate(() => window.__veilLength.snapshot().box)).toEqual([200, 200]);
});

for (const [valid, invalid] of [
  ['32', '50%'],
  ['0', '50%'],
  ['0px', '50%'],
  ['0', '1e309'],
  ['0px', '1e309'],
] as const) {
  test(`media-смена ${valid} на ${invalid} снимает эффект и сообщает ошибку`, async ({ page }) => {
    await load(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(
      ([value, error]) =>
        window.__veilLength.css(
          `.scope{--lab-veil-strength:${value}}@media(prefers-color-scheme:dark){.scope{--lab-veil-strength:${error}}}`,
        ),
      [valid, invalid],
    );
    await strength(page, Number.parseFloat(valid));
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
    await expect
      .poll(() => errors.some((message) => message.includes('--lab-veil-strength')))
      .toBe(true);
    await page.emulateMedia({ colorScheme: 'light' });
    await strength(page, Number.parseFloat(valid));
  });
}

test('feather принимает CSS-длину, эффект восстанавливается и освобождается', async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.__veilLength.feather('0.5rem'));
  await settle(page);
  const rem = await page.evaluate(() => window.__veilLength.snapshot().masks);
  await page.evaluate(() => window.__veilLength.feather('8px'));
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().masks)).toEqual(rem);
  expect(rem.length).toBeGreaterThan(0);
  await page.evaluate(() => window.__veilLength.feather('0px'));
  await expect
    .poll(() => page.evaluate(() => window.__veilLength.snapshot().masks))
    .not.toEqual(rem);
  await page.evaluate(() => window.__veilLength.feather('0.5rem'));
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().masks)).toEqual(rem);
  await page.evaluate(() => window.__veilLength.replace());
  await strength(page, 24);
  await page.evaluate(() => window.__veilLength.dispose());
  expect(await page.evaluate(() => window.__veilLength.snapshot())).toMatchObject({
    count: 0,
    children: 0,
    types: 0,
  });
});

for (const mode of ['open', 'closed'] as const) {
  test(`проекции работают в ${mode} Shadow DOM и живут до последнего владельца`, async ({
    page,
  }) => {
    await load(page);
    await page.evaluate((value) => window.__veilLength.startShadow(value), mode);
    await expect
      .poll(() => page.evaluate(() => window.__veilLength.shadowSnapshot().native))
      .toBe('blur(28px)');
    await expect
      .poll(async () =>
        Math.abs((await page.evaluate(() => window.__veilLength.shadowSnapshot().strength)) - 28),
      )
      .toBeLessThanOrEqual(0.02);
    expect(await page.evaluate(() => window.__veilLength.shadowSnapshot())).toMatchObject({
      types: 1,
      rootTypes: 1,
    });
    await page.evaluate(() => window.__veilLength.dispose());
    expect(await page.evaluate(() => window.__veilLength.shadowSnapshot().types)).toBe(1);
    await page.evaluate(() => window.__veilLength.shadowFont(48));
    await expect
      .poll(async () =>
        Math.abs((await page.evaluate(() => window.__veilLength.shadowSnapshot().strength)) - 40),
      )
      .toBeLessThanOrEqual(0.02);
    await page.evaluate(() => window.__veilLength.stopShadow());
    expect(await page.evaluate(() => window.__veilLength.snapshot().types)).toBe(0);
  });
}

test('проценты не превращаются в px и не оставляют старый blur', async ({ page }) => {
  await load(page);
  await strength(page, 24);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.evaluate(() => window.__veilLength.strength('50%'));
  await expect
    .poll(async () => (await page.evaluate(() => window.__veilLength.snapshot())).count)
    .toBe(0);
  expect(errors.some((message) => message.includes('--lab-veil-strength'))).toBe(true);
  await page.evaluate(() => window.__veilLength.strength('1.5rem'));
  await strength(page, 24);
});
