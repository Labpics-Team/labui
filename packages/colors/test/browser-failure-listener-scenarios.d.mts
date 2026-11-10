import type { LabuiColorsState, attachLabuiColors } from '@labui/colors/runtime';

export interface BrowserFailureEvent {
  state: LabuiColorsState['state'];
  reason: LabuiColorsState['reason'];
  cause: boolean;
}

export interface BrowserFailureListenerResult {
  listener: boolean;
  before: {
    state: LabuiColorsState['state'];
    reason: LabuiColorsState['reason'];
    returned: LabuiColorsState['state'];
    returnedReason: LabuiColorsState['reason'];
    nested: LabuiColorsState['state'] | undefined;
    nestedReason: LabuiColorsState['reason'] | undefined;
    cause: boolean;
    nestedCause: boolean;
    role: string;
    marker: boolean;
    calls: number;
    events: BrowserFailureEvent[];
  };
  retry: LabuiColorsState['state'];
  role: string;
  marker: boolean;
}

export function browserFailureListenerScenarios(
  attach: typeof attachLabuiColors,
): Promise<BrowserFailureListenerResult[]>;
