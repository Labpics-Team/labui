import { expect, test } from '@playwright/test';
import type {
  ColorsLiveAction,
  ColorsLiveReport,
  ColorsStateDelivery,
} from '../src/_fixtures/colors-live';

type LifecycleStep = Pick<ColorsStateDelivery, 'state' | 'reason'> &
  Partial<Pick<ColorsStateDelivery, 'theme' | 'role' | 'marker' | 'outputCount' | 'cleanupCause'>>;
type ActionStep = LifecycleStep & Pick<ColorsLiveAction, 'call'>;

const ready: LifecycleStep = { state: 'ready', reason: null };
const withdrawn: LifecycleStep = { state: 'waiting', reason: null, role: '' };
const cancelled: LifecycleStep = { state: 'cancelled', reason: 'cancelled', role: '' };
const disposed: LifecycleStep = { state: 'disposed', reason: null, marker: false };
const rejected: LifecycleStep = {
  state: 'failed',
  reason: 'unsupported_role_override',
  role: '',
};

const normalThemeActions: ActionStep[] = [
  { call: 'attach', ...ready, theme: 'light' },
  { call: 'refresh', ...ready, theme: 'light', role: 'rgb(31 32 33)' },
  { call: 'refresh', ...ready, theme: 'dark', role: 'rgb(31 32 33)' },
  { call: 'dispose', ...disposed, role: 'rgb(41 42 43)' },
];
const sheetRemovalActions: ActionStep[] = [
  { call: 'attach', ...ready, theme: 'light' },
  { call: 'refresh', ...ready, theme: 'light' },
  { call: 'dispose', ...disposed },
];
const authorityActions: Record<string, ActionStep[]> = {
  'normal-theme-dispose': normalThemeActions,
  'sheet-removed': sheetRemovalActions,
};

const authorityLifecycles: Record<string, LifecycleStep[]> = {
  'initial-important': [rejected, { ...disposed, role: 'rgb(255 0 0)' }],
  'live-important-recovery': [
    ready,
    rejected,
    { ...ready, role: 'rgb(21 22 23)' },
    { ...disposed, role: 'rgb(21 22 23)' },
  ],
  'normal-theme-dispose': normalThemeActions,
  'marker-changed': [ready, withdrawn, ready, disposed],
  'marker-removed': [ready, withdrawn, ready, disposed],
  'sheet-removed': sheetRemovalActions,
  'document-shadow-document': [ready, withdrawn, ready, withdrawn, ready, disposed],
  'cancel-recovery': [ready, cancelled, ready, disposed],
  'host-failure-recovery': [
    ready,
    { state: 'failed', reason: 'cleanup_failed', cleanupCause: 'host preparation refused' },
    cancelled,
    ready,
    disposed,
  ],
};

function followsLifecycle(history: ColorsStateDelivery[], steps: LifecycleStep[]): boolean {
  const terminal = history.findIndex(({ state }) => state === 'disposed');
  if (terminal !== -1 && terminal !== history.length - 1) return false;
  const fields = [
    'state',
    'reason',
    'theme',
    'role',
    'marker',
    'outputCount',
    'cleanupCause',
  ] as const;
  let next = 0;
  for (const delivery of history) {
    const step = steps[next];
    if (
      step &&
      (step.state !== 'ready' || delivery.role !== '') &&
      fields.every((field) => step[field] === undefined || delivery[field] === step[field])
    )
      next++;
  }
  return next === steps.length;
}

function followsResult(action: ColorsLiveAction): boolean {
  if (action.returned === null) return false;
  return action.retained || followsLifecycle(action.history, [action.returned]);
}

function followsActions(actions: ColorsLiveAction[], steps: ActionStep[]): boolean {
  return (
    actions.length === steps.length &&
    actions.every((action, index) => {
      const step = steps[index];
      return step && action.call === step.call && followsLifecycle(action.history, [step]);
    })
  );
}

function expectHistories(report: ColorsLiveReport<unknown>, attachments: number, healthy: number) {
  expect(report.histories).toHaveLength(attachments);
  expect(report.histories.map(({ control }) => control)).toEqual(report.controls);
  expect(
    report.histories.filter(({ history }) => history.some(({ state }) => state === 'ready')),
  ).toHaveLength(healthy);
  for (const { history, actions } of report.histories) {
    expect(history.length).toBeGreaterThan(0);
    expect(actions[0]?.call).toBe('attach');
    for (const [index, action] of actions.entries()) {
      expect(followsResult(action), `public result/onState ${action.call} ${index}`).toBe(true);
    }
    for (const delivery of history) {
      expect(delivery.reported).toBe(delivery.state);
      if (delivery.state === 'ready') {
        expect(delivery.outputCount).toBeGreaterThan(0);
        expect(delivery.role).not.toBe('');
      }
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
  for (const { control, history, actions } of report.histories) {
    const steps = authorityLifecycles[control];
    if (!steps) throw new Error(`Missing public lifecycle for ${control}`);
    expect(followsLifecycle(history, steps), `public onState: ${control}`).toBe(true);
    const actionSteps = authorityActions[control];
    if (actionSteps)
      expect(followsActions(actions, actionSteps), `public onState actions: ${control}`).toBe(true);
  }
});

test('Colors cleanup: transient failures restore owners before onState disposed', async ({
  page,
}) => {
  const report = await page.evaluate(() => window.__labColorsLive.cleanup());
  expect(report.controls).toEqual(['revoke', 'restore', 'canvas']);
  expectHistories(report, 3, 3);
  for (const { control, history } of report.histories) {
    expect(
      followsLifecycle(history, [
        ready,
        { state: 'failed', reason: 'cleanup_failed', cleanupCause: `${control} transient failure` },
        { ...disposed, role: 'rgb(31 32 33)' },
      ]),
      `public onState cleanup: ${control}`,
    ).toBe(true);
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
  for (const { control, history } of report.histories) {
    const terminal = control.action === 'dispose' ? 'disposed' : 'cancelled';
    expect(control.nested).toBe('waiting');
    expect(control.returned).toBe(terminal);
    expect(control.events).toEqual(['waiting', terminal]);
    const ending =
      control.action === 'cancel'
        ? [
            { ...cancelled, marker: true },
            { ...disposed, role: 'rgb(31 32 33)' },
          ]
        : [{ ...disposed, role: 'rgb(31 32 33)' }];
    expect(
      followsLifecycle(history, [
        ready,
        { state: 'waiting', reason: 'cleanup_pending' },
        ...ending,
      ]),
      `public onState replacement: ${control.entrance}/${control.action}`,
    ).toBe(true);
  }
});

test('Colors failure listener: persistent cause survives reentry and explicit retry', async ({
  page,
}) => {
  const report = await page.evaluate(() => window.__labColorsLive.failureListeners());
  expect(report.controls.map(({ listener }) => listener)).toEqual([false, true]);
  expectHistories(report, 2, 2);
  for (const { control, history } of report.histories) {
    expect(
      followsLifecycle(history, [
        ready,
        {
          state: 'failed',
          reason: 'cleanup_failed',
          cleanupCause: 'persistent DOM revoke refused',
        },
        { ...disposed, role: 'rgb(31 32 33)' },
      ]),
      `public onState failure listener: ${control.listener}`,
    ).toBe(true);
    expect(history.at(-1)).toMatchObject({ role: 'rgb(31 32 33)', priority: '' });
  }
});
