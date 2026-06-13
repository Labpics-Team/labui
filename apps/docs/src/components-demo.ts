import { el } from './template/dom.js';
/*
 * Components docs entry — boots the reusable component-doc template.
 *
 * Reads the `?component=<slug>` query, resolves the matching `ComponentDoc` from
 * the registry, and renders the full page into the mount node. Unknown or
 * missing slugs fall back to the first documented component (today: the proof),
 * so the page always shows something real and never a blank shell
 * (craft-frontend P6).
 *
 * This file is part of the closed template: adding a component never edits it.
 * It only knows the registry contract, not any specific component.
 */
import { REGISTRY, defaultSlug, findDoc } from './template/registry.js';
import { renderComponentPage } from './template/render-page.js';

const mount = document.querySelector<HTMLElement>('[data-testid="component-root"]');
if (!mount) {
  throw new Error('Missing #component-root mount node in components.html');
}

const params = new URLSearchParams(window.location.search);
const requested = params.get('component') ?? '';
const slug = findDoc(REGISTRY, requested) ? requested : (defaultSlug(REGISTRY) ?? '');

const doc = findDoc(REGISTRY, slug);
if (doc) {
  renderComponentPage(mount, REGISTRY, doc);
} else {
  // No documented component exists yet — an honest empty state, not a crash.
  mount.replaceChildren(
    el('main', { class: 'doc-main' }, [
      el('p', { class: 'empty-state', role: 'status' }, ['No components documented yet.']),
    ]),
  );
}
