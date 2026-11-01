import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { type Page, type TestInfo, expect, test } from '@playwright/test';

type Renderer = 'lit' | 'react';

test.describe('SSR до JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('все части Lit Switch разделяют effective initial state', async ({ page }) => {
    await page.goto('/_fixtures/switch-motion.html');
    const values = await page.evaluate(() => {
      const read = (name: string) => {
        const root = document.querySelector(`[data-testid="${name}"] lab-switch`)?.shadowRoot;
        if (!root) throw new Error('Отсутствует declarative Shadow DOM');
        const style = (selector: string) =>
          getComputedStyle(root.querySelector(selector) as HTMLElement);
        return {
          x: new DOMMatrixReadOnly(style('.thumb').transform).m41,
          color: style('.control').backgroundColor,
          on: style('.icon-on').opacity,
          off: style('.icon-off').opacity,
          checked: (root.querySelector('input') as HTMLInputElement).checked,
        };
      };
      return {
        on: read('lit-initial'),
        defaultOn: read('lit-default-initial'),
        off: read('lit-off-initial'),
        explicitOff: read('lit-explicit-off-initial'),
      };
    });
    expect(values.defaultOn).toEqual(values.on);
    expect(values.on.x).toBe(16);
    expect(values.on.checked).toBe(true);
    expect(values.on.on).toBe('1');
    expect(values.on.off).toBe('0');
    expect(values.off.x).toBe(0);
    expect(values.off.checked).toBe(false);
    expect(values.off.on).toBe('0');
    expect(values.off.off).toBe('1');
    expect(values.on.color).not.toBe(values.off.color);
    expect(values.explicitOff).toEqual(values.off);
  });
});

test('React SSR не запускает browser-only layout effect', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
    import { createElement } from 'react';
    import { renderToString } from 'react-dom/server';
    import { Switch } from '@labpics/ui-react/switch';
    console.log(renderToString(createElement(Switch, { checked: true }, 'SSR')));
  `,
    ],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, NODE_ENV: 'development' },
      encoding: 'utf8',
    },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('data-checked="true"');
  expect(result.stderr).not.toContain('useLayoutEffect does nothing on the server');
});

async function saveTrace(testInfo: TestInfo, name: string, value: unknown) {
  const path = testInfo.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: 'application/json' });
}

async function openFixture(page: Page) {
  await page.goto('/_fixtures/switch-motion.html');
  await expect(page.locator('html')).toHaveAttribute('data-motion-fixture-ready', 'true');
}

async function position(page: Page, renderer: Renderer) {
  return page.evaluate((renderer) => {
    const thumb = window.switchMotionFixture.thumb(renderer);
    return new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41;
  }, renderer);
}

test('SSR и hydration сохраняют изначально включённую позу', async ({ page, request }) => {
  const html = await (await request.get('/_fixtures/switch-motion.html')).text();
  expect(html).toContain('shadowrootmode="open"');
  expect(html).toMatch(/<lab-switch[^>]*\schecked(?:\s|=|>)/);
  expect(html).toContain('data-checked="true"');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openFixture(page);
  await expect(page.getByTestId('react-initial')).toHaveAttribute('data-node-preserved', 'true');
  for (const renderer of ['lit', 'react']) {
    const thumb = page
      .getByTestId(`${renderer}-initial`)
      .locator(renderer === 'lit' ? '.thumb' : '.lab-switch-thumb');
    const values = await thumb.evaluate(async (element) => {
      const values: number[] = [];
      for (let frame = 0; frame < 8; frame++) {
        values.push(new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return values;
    });
    for (const x of values) expect(x).toBeCloseTo(16, 2);
  }
  for (const [name, checked] of [
    ['lit-default-initial', true],
    ['lit-off-initial', false],
    ['lit-explicit-off-initial', false],
  ] as const) {
    const specimen = page.getByTestId(name);
    await expect(specimen.locator('input')).toBeChecked({ checked });
    const x = await specimen
      .locator('.thumb')
      .evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
    expect(x).toBeCloseTo(checked ? 16 : 0, 2);
  }
  expect(errors).toEqual([]);
});

test('Lit: явный checked=false сильнее defaultChecked=true', async ({ page }) => {
  await openFixture(page);
  const values = await page.evaluate(async () => {
    const result: Array<{ checked: boolean; x: number }> = [];
    for (const explicitFalse of [false, true]) {
      const element = document.createElement('lab-switch');
      element.defaultChecked = true;
      if (explicitFalse) element.checked = false;
      document.body.append(element);
      await element.updateComplete;
      await element.updateComplete;
      const input = element.shadowRoot?.querySelector('input');
      const thumb = element.shadowRoot?.querySelector('.thumb');
      if (!input || !thumb) throw new Error('Lit Switch должен отрендерить input и thumb');
      result.push({
        checked: input.checked,
        x: new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41,
      });
      element.remove();
    }
    return result;
  });
  expect(values).toEqual([
    { checked: true, x: 16 },
    { checked: false, x: 0 },
  ]);
});

for (const renderer of ['lit', 'react'] as const) {
  test(`${renderer}: состояние и цвет меняются сразу, движется только геометрия`, async ({
    page,
  }) => {
    await openFixture(page);
    const result = await page.evaluate(async (renderer) => {
      const fixture = window.switchMotionFixture;
      const thumb = fixture.thumb(renderer);
      const track = thumb.parentElement;
      if (!track) throw new Error('У бегунка должен быть track');
      const readColor = () => getComputedStyle(track).backgroundColor;
      const readPosition = () => new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41;
      const start = async () => {
        const before = readColor();
        await fixture.toggle(renderer);
        const state = {
          before,
          checked: fixture.input(renderer).checked,
          inputType: fixture.input(renderer).type,
          color: readColor(),
        };
        const [animation] = thumb.getAnimations();
        if (!animation || animation.playState !== 'running') {
          throw new Error('Switch должен самостоятельно запустить движение');
        }
        // toggle завершает commit в microtask: исходная анимация ещё не должна пропустить начало.
        if (animation.currentTime !== 0) {
          throw new Error(`Анимация должна начинаться с нуля: ${animation.currentTime}`);
        }
        const finished = animation.finished;
        await animation.ready;
        const timing = animation.effect?.getComputedTiming();
        const activeStart = Math.max(Math.min(Number(timing?.delay), Number(timing?.endTime)), 0);
        if (typeof timing?.localTime !== 'number' || !(timing.localTime >= activeStart)) {
          throw new Error(`Анимация не достигла активного интервала: ${JSON.stringify(timing)}`);
        }
        // Fixture не меняет скорость: native-время должно совпадать со временем воспроизведения.
        if (animation.playbackRate !== 1) {
          throw new Error(`Ожидалась обычная скорость native-анимации: ${animation.playbackRate}`);
        }
        const clock = {
          sameTimeline: animation.timeline === document.timeline,
          delay: timing.delay,
          endDelay: timing.endDelay,
          iterationStart: timing.iterationStart,
          iterations: timing.iterations,
          direction: timing.direction,
        };
        // Настройки default opening не сдвигают и не обрезают native-кривую.
        if (
          !clock.sameTimeline ||
          clock.delay !== 0 ||
          clock.endDelay !== 0 ||
          clock.iterationStart !== 0 ||
          clock.iterations !== 1 ||
          clock.direction !== 'normal'
        ) {
          throw new Error(`Нарушена исходная шкала native-анимации: ${JSON.stringify(clock)}`);
        }
        return { animation, finished, state };
      };
      const natural = await start();
      // Сначала движение завершается без вмешательства наблюдателя.
      await natural.finished;
      const completed = { ...natural.state, after: readColor(), final: readPosition() };
      await fixture.toggle(renderer);
      await Promise.all(thumb.getAnimations().map((animation) => animation.finished));
      const phase = await start();
      // Число rAF не задаёт фазу compositor: проверяем промежуточную native-позу.
      phase.animation.pause();
      phase.animation.currentTime = 32;
      const movingX = readPosition();
      const during = readColor();
      return {
        completed,
        phase: { ...phase.state, during },
        movingX,
      };
    }, renderer);
    for (const state of [result.completed, result.phase]) {
      expect(state.checked).toBe(true);
      expect(state.inputType).toBe('checkbox');
      expect(state.color).not.toBe(state.before);
    }
    expect(result.completed.after).toBe(result.completed.color);
    expect(result.completed.final).toBeCloseTo(16, 2);
    expect(result.phase.before).toBe(result.completed.before);
    expect(result.phase.during).toBe(result.phase.color);
    expect(result.movingX).toBeGreaterThan(0);
    expect(result.movingX).toBeLessThan(15.9);
  });

  test(`${renderer}: пружина достигает цели с небольшим выходом и обновляет input сразу`, async ({
    page,
  }, testInfo) => {
    await openFixture(page);
    const result = await page.evaluate(async (renderer) => {
      const fixture = window.switchMotionFixture;
      const thumb = fixture.thumb(renderer);
      const samples: Array<{ t: number; x: number }> = [];
      await fixture.toggle(renderer);
      const checked = fixture.input(renderer).checked;
      const [animation] = thumb.getAnimations();
      if (!animation) throw new Error('Switch должен запустить настоящую анимацию');
      const initialPlayState = animation.playState;
      await animation.ready;
      const timing = animation.effect?.getComputedTiming();
      const activeStart = Math.max(Math.min(Number(timing?.delay), Number(timing?.endTime)), 0);
      // ready разрешает pending play, но не доказывает начало активного интервала.
      if (typeof timing?.localTime !== 'number' || !(timing.localTime >= activeStart)) {
        throw new Error(`Анимация не достигла активного интервала: ${JSON.stringify(timing)}`);
      }
      const start = { localTime: timing.localTime, delay: timing.delay, activeStart };
      const duration = Number(timing.duration);
      // Сэмплируем нативную траекторию: доставка rAF не задаёт фазу compositor.
      animation.pause();
      for (let t = 0; t < duration; t += 8) {
        animation.currentTime = t;
        samples.push({ t, x: new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41 });
      }
      // Отдельно проверяем настоящее завершение без finish() или скачка в финал.
      animation.currentTime = 0;
      animation.play();
      await animation.finished;
      const final = new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41;
      return { checked, samples, duration, final, initialPlayState, start };
    }, renderer);
    await saveTrace(testInfo, `${renderer}-spring-trace`, result);
    expect(result.initialPlayState, 'Switch сам запускает движение').toBe('running');
    expect(result.checked).toBe(true);
    const peak = Math.max(...result.samples.map((sample) => sample.x));
    expect(peak, 'Физическая пружина проходит чуть дальше цели').toBeGreaterThan(16.01);
    expect(peak, 'Характер остаётся деликатным: выход меньше 5% хода').toBeLessThan(16.8);
    expect(result.final).toBeCloseTo(16, 2);
    await page.evaluate((renderer) => window.switchMotionFixture.toggle(renderer), renderer);
    await expect.poll(() => position(page, renderer)).toBeCloseTo(0, 2);
  });

  test(`${renderer}: смена цели подхватывает скорость без скачка позиции`, async ({
    page,
  }, testInfo) => {
    await openFixture(page);
    const result = await page.evaluate(async (renderer) => {
      const fixture = window.switchMotionFixture;
      const thumb = fixture.thumb(renderer);
      const read = () => new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41;
      const activeInterval = async (animation: Animation) => {
        await animation.ready;
        const timing = animation.effect?.getComputedTiming();
        const activeStart = Math.max(Math.min(Number(timing?.delay), Number(timing?.endTime)), 0);
        // Проверяем native localTime до pause/seek, учитывая границу effect.delay.
        if (typeof timing?.localTime !== 'number' || !(timing.localTime >= activeStart)) {
          throw new Error(`Анимация не достигла активного интервала: ${JSON.stringify(timing)}`);
        }
        return { localTime: timing.localTime, delay: timing.delay, activeStart };
      };
      const reverse = async () => {
        await fixture.toggle(renderer);
        const [opening] = thumb.getAnimations();
        if (!opening) throw new Error('Switch должен запустить настоящую анимацию');
        const openingStart = await activeInterval(opening);
        // Фиксируем только исходную фазу: новый retarget движется самостоятельно.
        opening.pause();
        opening.currentTime = 32;
        const before = read();
        await fixture.toggle(renderer);
        const after = read();
        const checked = fixture.input(renderer).checked;
        const [animation] = thumb.getAnimations();
        if (!animation) throw new Error('Смена цели должна продолжить анимацию');
        const start = await activeInterval(animation);
        return { before, after, checked, animation, openingStart, start };
      };
      const { animation: naturalAnimation, ...natural } = await reverse();
      // Не исправляем паузу или задержку запуска ручным play()/seek().
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Смена цели не завершилась самостоятельно за 5 с')),
          5_000,
        );
        naturalAnimation.finished.then(
          () => {
            clearTimeout(timeout);
            resolve(undefined);
          },
          (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        );
      });
      const final = read();
      // Скорость измеряем отдельно, не меняя естественное проигрывание выше.
      const { animation: phaseAnimation, ...phase } = await reverse();
      phaseAnimation.pause();
      phaseAnimation.currentTime = 8;
      return { natural, final, phase, next: read() };
    }, renderer);
    await saveTrace(testInfo, `${renderer}-retarget-trace`, result);
    for (const sample of [result.natural, result.phase]) {
      expect(sample.checked, JSON.stringify({ renderer, sample, result })).toBe(false);
      expect(sample.before).toBeGreaterThan(0.2);
      expect(
        Math.abs(sample.after - sample.before),
        'Смена цели не переносит бегунок',
      ).toBeLessThan(0.3);
    }
    expect(
      result.next - result.phase.after,
      'Сохранённая скорость сначала продолжает прежнее движение',
    ).toBeGreaterThan(0.02);
    expect(result.final).toBeCloseTo(0, 2);
  });

  test(`${renderer}: изменение rem и размера сохраняет конечную геометрию`, async ({ page }) => {
    await openFixture(page);
    await page.evaluate((renderer) => window.switchMotionFixture.toggle(renderer), renderer);
    await expect.poll(() => position(page, renderer)).toBeCloseTo(16, 2);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '20px';
    });
    await expect.poll(() => position(page, renderer)).toBeCloseTo(20, 2);
    await page.evaluate((renderer) => window.switchMotionFixture.size(renderer, 'l'), renderer);
    await expect.poll(() => position(page, renderer)).toBeCloseTo(25, 2);
    await page.evaluate((renderer) => window.switchMotionFixture.toggle(renderer), renderer);
    await expect.poll(() => position(page, renderer)).toBeCloseTo(0, 2);
  });

  test(`${renderer}: transform предка не меняет локальный ход бегунка`, async ({ page }) => {
    await openFixture(page);
    await page.evaluate((renderer) => {
      const mount = document.querySelector<HTMLElement>(
        renderer === 'lit' ? '#lit-mount' : '#react-motion',
      );
      if (!mount) throw new Error('Нет контейнера Switch');
      mount.style.transform = 'scale(1.5)';
      mount.style.transformOrigin = 'top left';
      return window.switchMotionFixture.toggle(renderer);
    }, renderer);
    await expect.poll(() => position(page, renderer)).toBeCloseTo(16, 2);
  });

  test(`${renderer}: CSS duration масштабирует скорость пружины`, async ({ page }, testInfo) => {
    const values: number[] = [];
    for (const duration of ['100ms', '500ms']) {
      await openFixture(page);
      values.push(
        await page.evaluate(
          async ({ renderer, duration }) => {
            document.documentElement.style.setProperty(
              '--lab-motion-transition-duration',
              duration,
            );
            await window.switchMotionFixture.toggle(renderer);
            const start = performance.now();
            do {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            } while (performance.now() - start < 80);
            return new DOMMatrixReadOnly(
              getComputedStyle(window.switchMotionFixture.thumb(renderer)).transform,
            ).m41;
          },
          { renderer, duration },
        ),
      );
    }
    await saveTrace(testInfo, `${renderer}-speed-trace`, {
      durationMs: [100, 500],
      afterMs: 80,
      positions: values,
    });
    expect(values[0]).toBeGreaterThan(5);
    expect(values[1]).toBeGreaterThan(0.1);
    expect(values[1]).toBeLessThan((values[0] ?? 0) * 0.6);
  });

  test(`${renderer}: системный reduced motion завершает уже начатое движение`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openFixture(page);
    await page.evaluate((renderer) => {
      document.documentElement.style.setProperty('--lab-motion-transition-duration', '500ms');
      return window.switchMotionFixture.toggle(renderer);
    }, renderer);
    await expect.poll(() => position(page, renderer)).toBeGreaterThan(0.2);
    const beforeReduced = await position(page, renderer);
    expect(beforeReduced).toBeLessThan(15.9);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const samples = await page.evaluate(async (renderer) => {
      const values: number[] = [];
      for (let i = 0; i < 5; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        values.push(
          new DOMMatrixReadOnly(
            getComputedStyle(window.switchMotionFixture.thumb(renderer)).transform,
          ).m41,
        );
      }
      return values;
    }, renderer);
    await saveTrace(testInfo, `${renderer}-reduced-trace`, { beforeReduced, afterFrames: samples });
    for (const x of samples.slice(1)) expect(x).toBeCloseTo(16, 2);
  });

  for (const disable of ['0ms', 'none']) {
    test(`${renderer}: CSS ${disable} отключает движение`, async ({ page }, testInfo) => {
      await openFixture(page);
      const values = await page.evaluate(
        async ({ renderer, disable }) => {
          const fixture = window.switchMotionFixture;
          const thumb = fixture.thumb(renderer);
          if (disable === 'none') thumb.style.transition = 'none';
          else
            document.documentElement.style.setProperty('--lab-motion-transition-duration', disable);
          await fixture.toggle(renderer);
          const values: number[] = [];
          for (let i = 0; i < 4; i++) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            values.push(new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41);
          }
          return values;
        },
        { renderer, disable },
      );
      await saveTrace(testInfo, `${renderer}-disable-${disable}-trace`, {
        disable,
        afterFrames: values,
      });
      for (const x of values) expect(x).toBeCloseTo(16, 2);
    });
  }

  for (const priority of ['', 'important']) {
    test(`${renderer}: новый inline transition-property сохраняется (${priority || 'normal'})`, async ({
      page,
    }, testInfo) => {
      await openFixture(page);
      const result = await page.evaluate(
        async ({ renderer, priority }) => {
          const fixture = window.switchMotionFixture;
          const thumb = fixture.thumb(renderer);
          const read = () => new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41;
          const frame = () =>
            new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          thumb.style.setProperty('transition-property', 'none', priority);
          await fixture.toggle(renderer);
          const disabled: number[] = [];
          for (let index = 0; index < 4; index++) {
            await frame();
            disabled.push(read());
          }
          // Удаление override возвращает CSS-настройку, а не прежнее сохранённое none.
          thumb.style.removeProperty('transition-property');
          await fixture.toggle(renderer);
          const resumed: number[] = [];
          for (let index = 0; index < 6; index++) {
            await frame();
            resumed.push(read());
          }
          // Последняя запись потребителя должна пережить cleanup даже без новой цели.
          thumb.style.setProperty('transition-property', 'opacity', priority);
          fixture.detach(renderer);
          return {
            disabled,
            resumed,
            restored: thumb.style.getPropertyValue('transition-property'),
            priority: thumb.style.getPropertyPriority('transition-property'),
          };
        },
        { renderer, priority },
      );
      await saveTrace(testInfo, `${renderer}-inline-override-${priority || 'normal'}`, result);
      for (const value of result.disabled) expect.soft(value).toBeCloseTo(16, 2);
      expect(result.resumed.some((value) => value > 0.01 && value < 15.99)).toBe(true);
      expect(result.restored).toBe('opacity');
      expect(result.priority).toBe(priority);
    });
  }

  test(`${renderer}: отключение снимает движение, возврат восстанавливает рабочий контрол`, async ({
    page,
  }) => {
    await openFixture(page);
    const detached = await page.evaluate(async (renderer) => {
      const fixture = window.switchMotionFixture;
      document.documentElement.style.setProperty('--lab-motion-transition-duration', '500ms');
      await fixture.toggle(renderer);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const thumb = fixture.detach(renderer);
      await Promise.resolve();
      let writes = 0;
      const observer = new MutationObserver((entries) => {
        writes += entries.length;
      });
      observer.observe(thumb, { attributes: true, attributeFilter: ['style'] });
      const transform = thumb.style.transform;
      for (let i = 0; i < 12; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      observer.disconnect();
      return {
        writes,
        transform,
        final: thumb.style.transform,
        animations: thumb.getAnimations().length,
      };
    }, renderer);
    expect(detached.writes).toBe(0);
    expect(detached.final).toBe(detached.transform);
    expect(detached.transform, 'Контроллер освобождает собственный inline transform').toBe('');
    expect(detached.animations).toBe(0);
    await page.evaluate(async (renderer) => {
      document.documentElement.style.removeProperty('--lab-motion-transition-duration');
      await window.switchMotionFixture.reconnect(renderer);
    }, renderer);
    await expect.poll(() => position(page, renderer)).toBeCloseTo(16, 2);
    await page.evaluate((renderer) => window.switchMotionFixture.toggle(renderer), renderer);
    await expect.poll(() => position(page, renderer)).toBeCloseTo(0, 2);
  });
}
