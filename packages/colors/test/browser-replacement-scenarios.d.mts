import type { LabuiColorsState, attachLabuiColors } from '@labui/colors/runtime';

export interface BrowserReplacementResult {
  entrance: 'replacement' | 'explicit';
  action: 'cancel' | 'dispose';
  nested: LabuiColorsState['state'];
  returned: LabuiColorsState['state'];
  role: string;
  marker: boolean;
  events: LabuiColorsState['state'][];
}

export function browserReplacementScenarios(
  attach: typeof attachLabuiColors,
): Promise<BrowserReplacementResult[]>;
