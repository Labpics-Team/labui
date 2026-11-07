import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { describe, expect, it } from 'vitest';
import { shapeCardRegions } from '../src/components/card/ssr.js';
import { html, renderToString, unsafeHTML } from '../src/ssr/index.js';
import '../src/components/card/index.js';

function regions(output: string) {
  return [...output.matchAll(/<div class="region (header|body|footer)-region"([^>]*)>/g)].map(
    ([, name, attrs]) => [name, !attrs?.includes('hidden')],
  );
}

describe('Card SSR: собственные регионы и native slot assignment', () => {
  it('первый paint отличает пустой media от назначенного и imageSrc', () => {
    const empty = renderToString(html`<lab-card heading="Heading"></lab-card>`);
    expect(empty).toMatch(/class="region media-region"[^>]*hidden/);
    const assigned = renderToString(html`<lab-card><div slot="media">Media</div></lab-card>`);
    expect(assigned).toMatch(/class="region media-region">/);
    const image = renderToString(
      html`<lab-card .imageSrc=${'image.png'}><div slot="media">Media</div></lab-card>`,
    );
    expect(image).not.toContain('class="region media-region"');
    expect(image).toContain('class="image"');
  });

  it.each(['', ' \t\n\f\r ', '<!-- comment -->', ' <!--lit-part x--> <!--/lit-part--> '])(
    'пустой default %j не создаёт регион между header/footer',
    (body) => {
      const output = renderToString(
        html`<lab-card><div slot="header">Header</div>${unsafeHTML(body)}<div slot="footer">Footer</div></lab-card>`,
      );
      expect(regions(output)).toEqual([
        ['header', true],
        ['body', false],
        ['footer', true],
      ]);
    },
  );

  it.each([
    'Body',
    '&nbsp;',
    '\u00a0',
    '\u2009',
    '&#x1f9ea;',
    '<span slot=""></span>',
    '<span></span>',
  ])('%j занимает default регион', (body) => {
    expect(regions(renderToString(html`<lab-card>${unsafeHTML(body)}</lab-card>`))).toEqual([
      ['header', false],
      ['body', true],
      ['footer', false],
    ]);
  });

  it('fallback берётся из отрендеренного shadow, включая Lit property-only данные', () => {
    expect(
      regions(
        renderToString(
          html`<lab-card .heading=${'Heading'} .description=${'Description'}></lab-card>`,
        ),
      ),
    ).toEqual([
      ['header', true],
      ['body', false],
      ['footer', false],
    ]);
    // Пустой назначенный Element подавляет fallback и остаётся назначением.
    expect(
      regions(
        renderToString(
          html`<lab-card .heading=${'Heading'}><span slot="header"></span></lab-card>`,
        ),
      ),
    ).toEqual([
      ['header', true],
      ['body', false],
      ['footer', false],
    ]);
  });

  it('вложенная Card и Card в чужом DSD получают собственное назначение', () => {
    const nested = renderToString(
      html`<lab-card><lab-card heading="Nested"></lab-card></lab-card>`,
    );
    expect(regions(nested)).toEqual([
      ['header', false],
      ['body', true],
      ['footer', false],
      ['header', true],
      ['body', false],
      ['footer', false],
    ]);
    // Lit не исполняет компоненты внутри caller <template>; такой DSD получает
    // уже собранный Card HTML, как material fixture существующего потребителя.
    const nestedOutput = collectResultSync(render(html`<lab-card>Body</lab-card>`));
    const foreign = shapeCardRegions(
      `<div><template shadowrootmode="open">${nestedOutput}</template></div>`,
    );
    expect(regions(foreign)).toEqual([
      ['header', false],
      ['body', true],
      ['footer', false],
    ]);
  });

  it('меняет только hidden, сохраняя исходные байты, Unicode и маркеры Lit', () => {
    const template = html`🧪${unsafeHTML('<style>/* <lab-card> */</style><!-- <lab-card> --><script>"<lab-card>"</script>')}<lab-card .heading=${'Heading'}>${unsafeHTML('<svg viewBox="0 0 2 2"><path d="M0 0 1 1"/></svg>')}</lab-card>`;
    const baseline = collectResultSync(render(template));
    const shaped = shapeCardRegions(baseline);
    expect(
      shaped.replace(/(class="region (?:media|header|body|footer)-region") hidden/g, '$1'),
    ).toBe(baseline);
    expect(regions(shaped)).toEqual([
      ['header', true],
      ['body', true],
      ['footer', false],
    ]);
    expect(shapeCardRegions(shaped)).toBe(shaped);
  });

  it.each([false, true])(
    'SSR сохраняет Boolean interactive=%s вместе с регионами',
    (interactive) => {
      const output = renderToString(
        html`<lab-card .interactive=${interactive} heading="Heading"></lab-card>`,
      );
      const snapshot = output.match(/data-lab-ssr-b1="([^"]+)"/)?.[1];
      expect(JSON.parse(snapshot?.replaceAll('&quot;', '"') ?? 'null')).toEqual([
        ['interactive', interactive],
      ]);
      expect(regions(output)).toEqual([
        ['header', true],
        ['body', false],
        ['footer', false],
      ]);
    },
  );

  it('не изменяет no-Card HTML, script/style/comment и чужую анатомию', () => {
    for (const source of [
      '<p title="&quot;">🧪 A &amp; B</p>',
      '<style>/* <lab-card> */</style><!-- <lab-card> --><script>"<lab-card>"</script>',
      '<lab-card><template shadowrootmode="open"><p>Other implementation</p></template></lab-card>',
    ])
      expect(shapeCardRegions(source)).toBe(source);
  });

  it.each([
    '<template><span>Preserve</span></template>',
    '<svg><template><circle cx="5" cy="5" r="2"></circle></template></svg>',
    '<math><template><mi>x</mi></template></math>',
  ])('соседний foreign content сохраняется побайтно: %s', (content) => {
    const template = html`${unsafeHTML(content)}<lab-card heading="Heading"></lab-card>`;
    const baseline = collectResultSync(render(template));
    const output = shapeCardRegions(baseline);
    expect(output).toContain(content);
    expect(
      output.replace(/(class="region (?:media|header|body|footer)-region") hidden/g, '$1'),
    ).toBe(baseline);
    expect(regions(output)).toEqual([
      ['header', true],
      ['body', false],
      ['footer', false],
    ]);
  });

  it.each([
    '<svg><lab-card><template shadowrootmode="open"><circle r="2"></circle></template></lab-card></svg>',
    '<math><lab-card><template shadowrootmode="open"><mi>x</mi></template></lab-card></math>',
  ])('foreign lab-card не получает обработку HTML Card: %s', (content) => {
    const template = html`<lab-card heading="Heading"></lab-card>`;
    const baseline = collectResultSync(render(template));
    expect(shapeCardRegions(content + baseline)).toBe(content + shapeCardRegions(baseline));
  });

  it('ошибка собственной анатомии не возвращает неправильный первый paint молча', () => {
    const source = collectResultSync(render(html`<lab-card></lab-card>`));
    expect(() => shapeCardRegions(source.replace('body-region', 'unknown-region'))).toThrow(
      'Card SSR: отсутствует собственный регион body',
    );
  });

  it.each(['ordinary', 'template'])(
    'широкий %s обход не зависит от лимита аргументов вызова',
    (container) => {
      const children = '<i></i>'.repeat(130_000);
      const card = collectResultSync(render(html`<lab-card heading="Heading"></lab-card>`));
      const baseline =
        container === 'ordinary'
          ? `<main>${card}${children}</main>`
          : `${card}<template>${children}</template>`;
      const output = shapeCardRegions(baseline);
      expect(output).toContain(children);
      expect(
        output.replace(/(class="region (?:media|header|body|footer)-region") hidden/g, '$1'),
      ).toBe(baseline);
      expect(regions(output)).toEqual([
        ['header', true],
        ['body', false],
        ['footer', false],
      ]);
    },
  );
});
