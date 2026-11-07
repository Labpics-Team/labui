import '@labui/colors/contract.css';
import { type LabuiColorsState, attachLabuiColors } from '@labui/colors/runtime';
import { browserAuthorityScenarios } from '../../../../packages/colors/test/browser-authority-scenarios.mjs';
import { browserCleanupScenarios } from '../../../../packages/colors/test/browser-cleanup-scenarios.mjs';
import { browserFailureListenerScenarios } from '../../../../packages/colors/test/browser-failure-listener-scenarios.mjs';
import { browserReplacementScenarios } from '../../../../packages/colors/test/browser-replacement-scenarios.mjs';

export interface ColorsStateDelivery {
  state: LabuiColorsState['state'];
  reason: LabuiColorsState['reason'];
  reported: string | null;
  role: string;
  priority: string;
  marker: boolean;
  outputCount: number | null;
  cleanupCause: string | null;
}

export interface ColorsLiveReport<Control> {
  controls: Control[];
  histories: { control: Control; history: ColorsStateDelivery[] }[];
}

async function runScenario<Control>(
  scenario: (attach: typeof attachLabuiColors) => Promise<Control[]>,
): Promise<ColorsLiveReport<Control>> {
  const histories: ColorsStateDelivery[][] = [];
  const attach: typeof attachLabuiColors = (options) => {
    const history: ColorsStateDelivery[] = [];
    histories.push(history);
    return attachLabuiColors({
      ...options,
      onState(state) {
        history.push({
          state: state.state,
          reason: state.reason,
          reported: options.scope.getAttribute('data-lab-colors-state'),
          role: getComputedStyle(options.scope).getPropertyValue('--lab-label-primary').trim(),
          priority: options.scope.style.getPropertyPriority('--lab-label-primary'),
          marker: options.scope.hasAttribute('data-lab-colors-scope'),
          outputCount: state.outputCount ?? null,
          cleanupCause: state.cleanup instanceof Error ? state.cleanup.message : null,
        });
        options.onState?.(state);
      },
    });
  };
  const controls = await scenario(attach);
  if (controls.length !== histories.length)
    throw new Error('Colors controls and attachment histories must correspond');
  return {
    controls,
    histories: controls.map((control, index) => {
      const history = histories[index];
      if (!history) throw new Error(`Colors control ${index} has no attachment history`);
      return { control, history };
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
