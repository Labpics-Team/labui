import { expect, test } from '@playwright/test';
import type { ColorsLiveReport } from '../src/_fixtures/colors-live';

function expectHistories(report: ColorsLiveReport<unknown>, attachments: number, healthy: number) {
  expect(report.histories).toHaveLength(attachments);
  expect(
    report.histories.filter((history) => history.some(({ state }) => state === 'ready')),
  ).toHaveLength(healthy);
  for (const history of report.histories) {
    expect(history.length).toBeGreaterThan(0);
    for (const delivery of history) {
      expect(delivery.reported).toBe(delivery.state);
      if (delivery.state === 'ready') expect(delivery.outputCount).toBeGreaterThan(0);
    }
    expect(history.at(-1)).toMatchObject({ state: 'disposed', marker: false });
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/colors-live.html');
  const contract = await page
    .getByTestId('contract-control')
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--lab-label-primary').trim(),
    );
  expect(contract, 'Generated contract must be present before Core attaches').not.toBe('');
});

test('Colors authority: refusal, withdrawal, observation, recovery and dispose', async ({
  page,
}) => {
  const report = await page.evaluate(() => window.__labColorsLive.authority());
  expect(report.controls).toEqual([
    'initial-important',
    'live-important-recovery',
    'normal-theme-dispose',
    'marker-changed',
    'marker-removed',
    'sheet-removed',
    'document-shadow-document',
    'cancel-recovery',
    'host-failure-recovery',
  ]);
  expectHistories(report, 9, 8);
  expect(report.histories.flat()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ reason: 'unsupported_role_override', role: '' }),
      expect.objectContaining({ state: 'cancelled', role: '' }),
      expect.objectContaining({
        reason: 'cleanup_failed',
        cleanupCause: 'host preparation refused',
      }),
    ]),
  );
});

test('Colors cleanup: transient failures restore owners before onState disposed', async ({
  page,
}) => {
  const report = await page.evaluate(() => window.__labColorsLive.cleanup());
  expect(report.controls).toEqual(['revoke', 'restore', 'canvas']);
  expectHistories(report, 3, 3);
  for (const history of report.histories) {
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ state: 'failed', reason: 'cleanup_failed' }),
      ]),
    );
    expect(history.at(-1)).toMatchObject({ role: 'rgb(31 32 33)', priority: '' });
  }
});

test('Colors replacement: nested cancel and dispose drain truthful terminal states', async ({
  page,
}) => {
  const report = await page.evaluate(() => window.__labColorsLive.replacement());
  expect(report.controls.map(({ entrance, action }) => [entrance, action])).toEqual([
    ['replacement', 'cancel'],
    ['replacement', 'dispose'],
    ['explicit', 'cancel'],
    ['explicit', 'dispose'],
  ]);
  expectHistories(report, 4, 4);
  for (const control of report.controls) {
    const terminal = control.action === 'dispose' ? 'disposed' : 'cancelled';
    expect(control.nested).toBe('waiting');
    expect(control.returned).toBe(terminal);
    expect(control.events).toEqual(['waiting', terminal]);
  }
});

test('Colors failure listener: persistent cause survives reentry and explicit retry', async ({
  page,
}) => {
  const report = await page.evaluate(() => window.__labColorsLive.failureListeners());
  expect(report.controls.map(({ listener }) => listener)).toEqual([false, true]);
  expectHistories(report, 2, 2);
  for (const history of report.histories) {
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: 'failed',
          reason: 'cleanup_failed',
          cleanupCause: 'persistent DOM revoke refused',
        }),
      ]),
    );
    expect(history.at(-1)).toMatchObject({ role: 'rgb(31 32 33)', priority: '' });
  }
});
