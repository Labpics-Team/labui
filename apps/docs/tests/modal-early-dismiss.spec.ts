import { expect, test } from '@playwright/test';

interface EarlyDismissRecord {
  kind: string;
  key: string;
  trusted: boolean;
  frame: number;
  time: number;
}

declare global {
  interface Window {
    earlyDismissProbe: { frames: number; events: EarlyDismissRecord[] };
  }
}

for (const id of ['sheet', 'vue']) {
  test(`${id}: первый trusted Escape отменяет открытие без ожидания RAF или фокуса`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      window.earlyDismissProbe = { frames: 0, events: [] };
      const frame = () => {
        window.earlyDismissProbe.frames++;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      const capture = (event: Event) => {
        if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
        const probe = window.earlyDismissProbe;
        probe.events.push({
          kind: event.type,
          key: event instanceof KeyboardEvent ? event.key : '',
          trusted: event.isTrusted,
          frame: probe.frames,
          time: performance.now(),
        });
      };
      document.addEventListener('click', capture, true);
      document.addEventListener('keydown', capture, true);
    });
    await page.goto('/_fixtures/modal-live.html');
    await expect(page.locator('html')).toHaveAttribute('data-modal-live-ready', 'true');
    const host = page.getByTestId(id);
    const portal = page.locator(`[data-portal-for="${id}"]`);
    const trigger = await host.locator('.trigger').boundingBox();
    if (!trigger) throw new Error('Не найден trigger');
    const histories: Array<{ open: boolean; events: EarlyDismissRecord[] }> = [];
    for (let trial = 0; trial < 3; trial++) {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => {
              window.earlyDismissProbe.events = [];
              resolve();
            }),
          ),
      );
      await page.mouse.click(trigger.x + trigger.width / 2, trigger.y + trigger.height / 2);
      await page.keyboard.press('Escape');
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const record = await host.evaluate((element) => ({
        open: (element as HTMLElement & { open: boolean }).open,
        events: [...window.earlyDismissProbe.events],
      }));
      histories.push(record);
      expect(record.events.some((event) => event.kind === 'click' && event.trusted)).toBe(true);
      expect(record.events.some((event) => event.kind === 'keydown' && event.trusted)).toBe(true);
      if (record.open) await page.keyboard.press('Escape');
      await expect(portal.locator('.content')).toBeHidden();
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
        .not.toBe('hidden');
    }
    await testInfo.attach('trusted-early-dismiss.json', {
      body: JSON.stringify({ id, histories, errors }, null, 2),
      contentType: 'application/json',
    });
    expect(histories.map((history) => history.open)).toEqual([false, false, false]);
    expect(errors).toEqual([]);
  });
}
