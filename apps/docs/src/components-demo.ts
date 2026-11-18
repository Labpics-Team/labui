import { el } from './template/dom.js';
import { REGISTRY, findEntry, loadDoc } from './template/registry.js';
import { renderCatalogPage } from './template/render-catalog.js';
import { renderComponentPage } from './template/render-page.js';

const mount = document.querySelector<HTMLElement>('[data-testid="component-root"]');
if (!mount) throw new Error('Missing component-root mount node');
const requested = new URLSearchParams(window.location.search).get('component') ?? '';
const entry = findEntry(REGISTRY, requested);
document.title = `${entry?.title ?? (requested ? 'Компонент не найден' : 'Каталог компонентов')} — LabUI`;
if (entry?.documentation) {
  mount.replaceChildren(
    el('main', { class: 'doc-main doc-loading', 'aria-busy': 'true' }, [
      el('p', { role: 'status' }, [`Загрузка ${entry.title}…`]),
    ]),
  );
  loadDoc(entry)
    .then((doc) => {
      if (doc) renderComponentPage(mount, REGISTRY, doc);
    })
    .catch(() => {
      mount.replaceChildren(
        el('main', { class: 'doc-main doc-loading' }, [
          el('h1', {}, [entry.title]),
          el('p', { role: 'alert' }, ['Не удалось загрузить пример.']),
          el('a', { href: window.location.href }, ['Повторить']),
        ]),
      );
    });
} else renderCatalogPage(mount, REGISTRY, entry, requested);
