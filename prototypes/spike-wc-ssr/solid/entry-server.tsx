// Solid SSR entry. Uses solid-js/web renderToString (the SolidStart SSR core).
import { renderToString } from 'solid-js/web';
import { renderButtonsToString } from '../shared/render-button.mjs';
import { App } from './App';

export function render(): string {
  const litSsrHtml = renderButtonsToString();
  return renderToString(() => App({ litSsrHtml }));
}
