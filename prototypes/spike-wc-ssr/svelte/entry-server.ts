// Svelte 5 SSR entry. Uses svelte/server render() (the SvelteKit SSR core) to
// produce HTML. The Lit-SSR DSD string is rendered server-side and threaded in.
import { render as svelteRender } from 'svelte/server';
import { renderButtonsToString } from '../shared/render-button.mjs';
// @ts-expect-error - .svelte component type resolved by the svelte plugin
import App from './App.svelte';

export function render(): string {
  const litSsrHtml = renderButtonsToString();
  const { body } = svelteRender(App, { props: { litSsrHtml } });
  return body;
}
