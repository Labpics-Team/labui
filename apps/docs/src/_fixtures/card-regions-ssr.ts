/** Настоящие raw и generated SSR-входы разделяют одну Card-анатомию. */
export async function renderCardRegions(): Promise<string> {
  const { html, renderToString, unsafeHTML } = await import('@labpics/ui-core/ssr');
  const { renderCard } = await import('@labpics/ui-vue/ssr');
  await import('@labpics/ui-core/card');
  const cases = [
    { id: 'empty', body: '', ends: true },
    { id: 'raw', body: 'Body', ends: true },
    { id: 'spaces', body: ' \t\n<!-- caller comment -->', ends: true },
    {
      id: 'inline',
      body: '<span data-region-probe="a">A</span><span data-region-probe="b">B</span>',
    },
    {
      id: 'paragraph',
      body: '<p data-region-probe="paragraph" style="margin:16px 0">Paragraph</p>',
    },
    { id: 'nbsp', body: '&nbsp;' },
    { id: 'explicit-default', body: '<span slot="">Default</span>' },
    { id: 'empty-header', body: '<span slot="header"></span>', heading: 'Suppressed' },
  ];
  return cases
    .map(({ id, body, ends, heading }) => {
      const header = ends ? '<div>Header</div>' : undefined;
      const footer = ends ? '<div>Footer</div>' : undefined;
      const raw = renderToString(
        html`<lab-card heading=${heading ?? ''} style="width:400px;font:400 16px/24px Geist,sans-serif">${header ? html`<span slot="header">${unsafeHTML(header)}</span>` : ''}${unsafeHTML(body)}${footer ? html`<span slot="footer">${unsafeHTML(footer)}</span>` : ''}</lab-card>`,
      );
      const generated = renderCard({ heading }, { header, footer, default: body });
      return `<section data-region-case="${id}"><div id="region-raw-${id}" style="width:400px;font:400 16px/24px Geist,sans-serif">${raw}</div><div id="region-generated-${id}" style="width:400px;font:400 16px/24px Geist,sans-serif">${generated}</div></section>`;
    })
    .join('');
}
