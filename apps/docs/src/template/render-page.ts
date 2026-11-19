/** Renders authored live documentation inside the semantic catalog navigation. */
import type { ComponentDoc } from './component-doc.js';
import { el, section } from './dom.js';
import { type Registry, findEntry } from './registry.js';
import { renderCapabilities, renderSourceCoverage } from './render-catalog.js';
import {
  renderAnatomy,
  renderApi,
  renderLiveExample,
  renderMeaning,
  renderStatesMatrix,
  renderStatusBadge,
} from './render-sections.js';
import { renderRootControls } from './root-controls.js';
import { renderSidebar } from './sidebar.js';

/**
 * Render the full page for `doc` into `mount`, with a sidebar built from the
 * whole `registry` so navigation is ready to accept future components. Wires the
 * theme/material switchers onto the document root. Idempotent: clears `mount`
 * first, so it is safe to call on route change.
 */
export function renderComponentPage(
  mount: HTMLElement,
  registry: Registry,
  doc: ComponentDoc,
): void {
  mount.replaceChildren();
  const entry = findEntry(registry, doc.slug);
  if (!entry) throw new Error(`Documentation outside catalog: ${doc.slug}`);

  const header = el('header', { class: 'doc-header' }, [
    el('div', { class: 'doc-title-row' }, [
      el('h1', { id: 'doc-title' }, [el('code', {}, [doc.tag]), ` — ${doc.title}`]),
      ...(entry.kind === 'internal' ? [renderStatusBadge(doc.status)] : []),
    ]),
    el('p', { class: 'doc-summary' }, [entry.summary]),
    renderCapabilities(entry),
    renderRootControls(),
  ]);

  const main = el('main', { class: 'doc-main', id: 'doc-main' }, [
    header,
    renderSourceCoverage(entry),
    section('sec-states', 'Состояния', [renderStatesMatrix(doc.statesMatrix)]),
    section('sec-anatomy', 'Анатомия', [renderAnatomy(doc.liveExample.make(), doc.anatomy)]),
    section('sec-meaning', 'Применение', [renderMeaning(doc.meaning)]),
    section('sec-live', 'Живой пример', [renderLiveExample(doc.liveExample)]),
    section('sec-api', 'Props / API', [
      renderApi(doc.api),
      el('details', { class: 'catalog-example-note' }, [
        el('summary', {}, ['Примечание к текущему примеру']),
        el('p', {}, [doc.summary]),
      ]),
    ]),
  ]);

  const layout = el('div', { class: 'doc-layout' }, [renderSidebar(registry, doc.slug), main]);
  mount.append(layout);
}
