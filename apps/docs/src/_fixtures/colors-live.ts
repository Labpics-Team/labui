import '@labui/colors/contract.css';
import { type LabuiColorsState, attachLabuiColors } from '@labui/colors/runtime';
import { browserAuthorityScenarios } from '../../../../packages/colors/test/browser-authority-scenarios.mjs';
import { browserCleanupScenarios } from '../../../../packages/colors/test/browser-cleanup-scenarios.mjs';
import { browserFailureListenerScenarios } from '../../../../packages/colors/test/browser-failure-listener-scenarios.mjs';
import { browserReplacementScenarios } from '../../../../packages/colors/test/browser-replacement-scenarios.mjs';

export interface ColorsStateResult {
  state: LabuiColorsState['state'];
  reason: LabuiColorsState['reason'];
  theme: LabuiColorsState['theme'] | null;
  outputCount: number | null;
  cleanupCause: string | null;
}

export interface ColorsStateDelivery extends ColorsStateResult {
  reported: string | null;
  role: string;
  priority: string;
  marker: boolean;
}

export interface ColorsLiveAction {
  call: 'attach' | 'refresh' | 'cancel' | 'dispose';
  history: ColorsStateDelivery[];
  returned: ColorsStateResult | null;
}

export interface ColorsLiveReport<Control> {
  controls: Control[];
  histories: { control: Control; history: ColorsStateDelivery[]; actions: ColorsLiveAction[] }[];
}

function summarizeState(state: LabuiColorsState): ColorsStateResult {
  return {
    state: state.state,
    reason: state.reason,
    theme: state.theme ?? null,
    outputCount: state.outputCount ?? null,
    cleanupCause: state.cleanup instanceof Error ? state.cleanup.message : null,
  };
}

async function runScenario<Control>(
  scenario: (attach: typeof attachLabuiColors) => Promise<Control[]>,
): Promise<ColorsLiveReport<Control>> {
  const histories: { history: ColorsStateDelivery[]; actions: ColorsLiveAction[] }[] = [];
  const attach: typeof attachLabuiColors = (options) => {
    const history: ColorsStateDelivery[] = [];
    const actions: ColorsLiveAction[] = [];
    const active = new Set<ColorsLiveAction>();
    histories.push({ history, actions });
    const invoke = <Result>(call: ColorsLiveAction['call'], operation: () => Result) => {
      const action: ColorsLiveAction = { call, history: [], returned: null };
      actions.push(action);
      active.add(action);
      try {
        return { action, result: operation() };
      } catch (error) {
        active.delete(action);
        throw error;
      }
    };
    const complete = (action: ColorsLiveAction, state: LabuiColorsState) => {
      action.returned = summarizeState(state);
      active.delete(action);
    };
    const observe = (action: ColorsLiveAction, promise: Promise<LabuiColorsState>) => {
      // Наблюдаем до продолжения сценария, сохраняя исходный публичный Promise.
      void promise.then(
        (state) => complete(action, state),
        () => active.delete(action),
      );
      return promise;
    };
    const { action: attaching, result: attachment } = invoke('attach', () =>
      attachLabuiColors({
        ...options,
        onState(state) {
          const delivery = {
            ...summarizeState(state),
            reported: options.scope.getAttribute('data-lab-colors-state'),
            role: getComputedStyle(options.scope).getPropertyValue('--lab-label-primary').trim(),
            priority: options.scope.style.getPropertyPriority('--lab-label-primary'),
            marker: options.scope.hasAttribute('data-lab-colors-scope'),
          };
          history.push(delivery);
          for (const action of active) action.history.push(delivery);
          options.onState?.(state);
        },
      }),
    );
    const sync = (call: 'cancel' | 'dispose') => {
      const { action, result } = invoke(call, () => attachment[call]());
      complete(action, result);
      return result;
    };
    return {
      ready: observe(attaching, attachment.ready),
      get state() {
        return attachment.state;
      },
      refresh() {
        const { action, result } = invoke('refresh', () => attachment.refresh());
        return observe(action, result);
      },
      cancel: () => sync('cancel'),
      dispose: () => sync('dispose'),
    };
  };
  const controls = await scenario(attach);
  if (controls.length !== histories.length)
    throw new Error('Colors controls and attachment histories must correspond');
  return {
    controls,
    histories: controls.map((control, index) => {
      const recorded = histories[index];
      if (!recorded) throw new Error(`Colors control ${index} has no attachment history`);
      return { control, ...recorded };
    }),
  };
}

const hooks = {
  authority: () => runScenario(browserAuthorityScenarios),
  cleanup: () => runScenario(browserCleanupScenarios),
  replacement: () => runScenario(browserReplacementScenarios),
  failureListeners: () => runScenario(browserFailureListenerScenarios),
};

export type ColorsLiveHooks = typeof hooks;

declare global {
  interface Window {
    __labColorsLive: ColorsLiveHooks;
  }
}

window.__labColorsLive = hooks;
