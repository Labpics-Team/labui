import { el } from './dom.js';
import { CATALOG, type Registry, type RegistryEntry } from './registry.js';
import { renderSidebar } from './sidebar.js';

export function renderCapabilities(entry: RegistryEntry): HTMLElement {
  return el('div', { class: 'catalog-capabilities', 'aria-label': 'Доступность API' }, [
    el('span', { 'data-capability': entry.capabilities.web ? 'available' : 'missing' }, [
      `Web · ${entry.capabilities.web ? 'есть API' : 'нет API'}`,
    ]),
    el('span', { 'data-capability': entry.capabilities.native ? 'available' : 'missing' }, [
      `Compose · ${entry.capabilities.native ? 'есть API' : 'нет API'}`,
    ]),
  ]);
}

/** A binding covers only its named scope, never every visual variant. */
export function renderSourceCoverage(entry: RegistryEntry): HTMLElement {
  const content: HTMLElement[] = [
    el('p', {}, [
      'Доступность API не подтверждает все варианты Figma. Ниже указаны только сопоставленные представления; темы, состояния и геометрия требуют отдельной проверки.',
    ]),
  ];
  if (entry.sources.length) {
    const role = {
      root: 'Семейство',
      variant: 'Представление',
      part: 'Часть',
      material: 'Материал',
    };
    const table = el('table', { class: 'catalog-source-table' }, [
      el('caption', {}, ['Соответствие авторскому источнику']),
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Источник', 'Роль', 'Web', 'Compose'].map((title) =>
            el('th', { scope: 'col' }, [title]),
          ),
        ),
      ]),
      el(
        'tbody',
        {},
        entry.sources.map((source) =>
          el('tr', {}, [
            el('th', { scope: 'row' }, [
              el('span', { class: 'source-page' }, [source.page]),
              source.name,
              el('span', { class: 'source-page' }, [
                source.type === 'component-set' ? 'Набор вариантов' : 'Компонент',
              ]),
            ]),
            el('td', {}, [role[source.role]]),
            el('td', {}, [source.web?.scope ?? 'Не сопоставлено']),
            el('td', {}, [source.native?.scope ?? 'Не сопоставлено']),
          ]),
        ),
      ),
    ]);
    content.push(
      el(
        'div',
        {
          class: 'catalog-table-scroll',
          tabindex: '0',
          'aria-label': 'Соответствие Figma, прокручиваемая таблица',
        },
        [table],
      ),
    );
  } else
    content.push(
      el('p', {}, [
        entry.kind === 'internal'
          ? 'Технический пример для разработки.'
          : 'Расширение LabUI: прямой одноимённый источник в авторском каталоге не назначен.',
      ]),
    );
  if (entry.capabilities.native) {
    const native = entry.capabilities.native;
    const provenance: (string | HTMLElement)[] = [];
    if ('dependency' in native) {
      const { module, version, githubRepository, mavenRepositoryCommit } = native.dependency;
      const [group, artifact] = module.split(':');
      const modulePath = `${group?.replaceAll('.', '/')}/${artifact}`;
      provenance.push(
        '. Включён в LabUI через ',
        el('code', {}, [`${module}:${version}`]),
        ' · ',
        el(
          'a',
          {
            href: `https://github.com/${githubRepository}/tree/${mavenRepositoryCommit}/${modulePath}/${version}`,
          },
          ['опубликованный выпуск'],
        ),
      );
    } else {
      provenance.push(
        '. Наличие API проверено по ',
        el(
          'a',
          { href: `https://github.com/Labpics-Team/labui/blob/${native.revision}/${native.file}` },
          ['исходнику'],
        ),
      );
    }
    content.push(
      el('p', { class: 'catalog-api-note' }, [
        'Compose: ',
        el('code', {}, [native.symbol]),
        ...provenance,
        '; это не отчёт о проверке всех платформ.',
      ]),
    );
  }
  content.push(
    el('a', { href: CATALOG.source.publicUrl }, [`Авторский источник · ${CATALOG.source.edition}`]),
  );
  return el('details', { class: 'catalog-coverage' }, [
    el('summary', {}, ['Состав семейства и соответствие Figma']),
    ...content,
  ]);
}

export function renderCatalogPage(
  mount: HTMLElement,
  registry: Registry,
  entry?: RegistryEntry,
  requested = '',
): void {
  let main: HTMLElement;
  if (entry) {
    main = el('main', { class: 'doc-main', id: 'doc-main' }, [
      el('header', { class: 'doc-header' }, [
        el('p', { class: 'catalog-eyebrow' }, ['Каталог компонентов']),
        el('h1', { id: 'doc-title' }, [entry.title]),
        el('p', { class: 'doc-summary' }, [entry.summary]),
        renderCapabilities(entry),
      ]),
      el('section', { class: 'catalog-unavailable' }, [
        el('h2', {}, [
          entry.kind === 'material'
            ? 'Поверхности LabUI'
            : entry.capabilities.web || entry.capabilities.native
              ? 'Документация примера готовится'
              : 'Реализация ещё не добавлена',
        ]),
        el('p', {}, [
          entry.kind === 'material'
            ? 'Материалы используются компонентами. Состав авторских уровней приведён ниже.'
            : entry.capabilities.web || entry.capabilities.native
              ? 'Публичный API доступен; живой пример этого семейства ещё не добавлен.'
              : 'Семейство включено в авторский каталог. Живой пример и импорт появятся вместе с публичной реализацией.',
        ]),
        ...(entry.guide ? [el('a', { href: entry.guide.href }, [entry.guide.label])] : []),
      ]),
      renderSourceCoverage(entry),
    ]);
  } else if (requested) {
    main = el('main', { class: 'doc-main', id: 'doc-main' }, [
      el('header', { class: 'doc-header' }, [
        el('h1', { id: 'doc-title' }, ['Компонент не найден']),
        el('p', { class: 'doc-summary' }, [
          'В каталоге нет адреса ',
          el('code', {}, [requested]),
          '.',
        ]),
        el('a', { href: 'components.html' }, ['Открыть каталог компонентов']),
      ]),
    ]);
  } else {
    const sections = CATALOG.groups
      .filter((group) => group.id !== 'development')
      .map((group) =>
        el('section', { class: 'catalog-group', 'aria-labelledby': `catalog-${group.id}` }, [
          el('h2', { id: `catalog-${group.id}` }, [group.title]),
          el(
            'ul',
            { class: 'catalog-grid' },
            registry
              .filter((family) => family.group === group.id)
              .map((family) =>
                el('li', {}, [
                  el('a', { class: 'catalog-item', href: `?component=${family.slug}` }, [
                    el('h3', {}, [family.title]),
                    el('p', {}, [family.summary]),
                    renderCapabilities(family),
                  ]),
                ]),
              ),
          ),
        ]),
      );
    main = el('main', { class: 'doc-main', id: 'doc-main' }, [
      el('header', { class: 'doc-header catalog-header' }, [
        el('p', { class: 'catalog-eyebrow' }, ['Lab UI v2.1']),
        el('h1', { id: 'doc-title' }, ['Каталог компонентов']),
        el('p', { class: 'doc-summary' }, [
          'Компоненты по назначению: от поля ввода до сложной композиции. Откройте семейство, чтобы изучить анатомию, состояния, пример и доступный API.',
        ]),
        el('p', { class: 'catalog-api-note' }, [
          'Web и Compose показывают наличие публичного API. Полнота авторских вариантов описана внутри семейства.',
        ]),
      ]),
      ...sections,
    ]);
  }
  mount.replaceChildren(
    el('div', { class: 'doc-layout' }, [renderSidebar(registry, entry?.slug ?? requested), main]),
  );
}
