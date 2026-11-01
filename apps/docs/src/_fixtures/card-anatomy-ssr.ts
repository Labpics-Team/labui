import { renderToString as renderReact } from 'react-dom/server';
import { cardSpecs } from './card-anatomy-cases';
import { reactCard } from './card-anatomy-react';

export async function renderCardAnatomy(): Promise<string> {
  const { html, renderToString, ifDefined } = await import('@labpics/ui-core/ssr');
  await import('@labpics/ui-core/card');
  await import('@labpics/ui-core/button');
  return cardSpecs
    .map((spec) => {
      const props = spec.props ?? {};
      const style = `width:${spec.width ?? 400}px;${spec.height === undefined ? '' : `height:${spec.height}px`}`;
      const core = renderToString(html`<lab-card
      id=${`core-${spec.id}`} style=${style}
      image-src=${ifDefined(props.imageSrc)} image-alt=${ifDefined(props.imageAlt)}
      heading=${ifDefined(props.heading)} heading-level=${ifDefined(props.headingLevel)}
      caption=${ifDefined(props.caption)} description=${ifDefined(props.description)}
      lower-caption=${ifDefined(props.lowerCaption)} padding=${ifDefined(props.padding)}
      title-hint=${ifDefined(props.titleHint)} badge=${ifDefined(props.badge)}
    >${spec.header ? html`<h3 slot="header" data-probe="header">Своя шапка</h3>` : ''}${spec.media ? html`<div slot="media" data-probe="media">Своя медиа-область</div>` : ''}${spec.body ? html`<div data-probe="body">Своё содержимое</div>` : ''}${spec.footer ? html`<lab-button slot="footer" data-probe="footer" type="accent">Открыть</lab-button>` : ''}</lab-card>`);
      return `<section data-case="${spec.id}"><div data-renderer="core">${core}</div><div data-renderer="react" id="react-mount-${spec.id}">${renderReact(reactCard(spec))}</div></section>`;
    })
    .join('');
}
