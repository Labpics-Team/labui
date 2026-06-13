/*
 * Page renderer — assembles a full component docs page from one `ComponentDoc`.
 *
 * This is the TEMPLATE: closed for modification (craft-arch / OCP). It renders
 * the six sections in a fixed order for ANY component, plus the cross-cutting
 * theme + material switchers that prove the documented element is theme- and
 * material-agnostic (the owner's requirement: one attribute flip on the root
 * re-skins everything below, with zero element edits).
 *
 * Documenting a new component never touches this file — you author a new
 * `ComponentDoc` and register a route. That is the whole point of the seam.
 */
import type { ComponentDoc } from './component-doc.js';
import { el, section } from './dom.js';
import type { Registry } from './registry.js';
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

  const header = el('header', { class: 'doc-header' }, [
    el('div', { class: 'doc-title-row' }, [
      el('h1', { id: 'doc-title' }, [el('code', {}, [doc.tag]), ` — ${doc.title}`]),
      renderStatusBadge(doc.status),
    ]),
    el('p', { class: 'doc-summary' }, [doc.summary]),
    renderRootControls(),
  ]);

  const main = el('main', { class: 'doc-main', id: 'doc-main' }, [
    header,
    section('sec-states', 'States matrix', [renderStatesMatrix(doc.statesMatrix)]),
    section('sec-anatomy', 'Anatomy', [renderAnatomy(doc.statesMatrix.make({}), doc.anatomy)]),
    section('sec-meaning', 'Meaning & usage', [renderMeaning(doc.meaning)]),
    section('sec-live', 'Live example', [renderLiveExample(doc.liveExample)]),
    section('sec-api', 'Props / API', [renderApi(doc.api)]),
  ]);

  const layout = el('div', { class: 'doc-layout' }, [renderSidebar(registry, doc.slug), main]);
  mount.append(layout);
}
