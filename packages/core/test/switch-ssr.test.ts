import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { type DefaultTreeAdapterMap, parseFragment } from 'parse5';
import { describe, expect, it } from 'vitest';
import { shapeSwitchLabels } from '../src/components/switch/ssr.js';
import { html, renderToString, unsafeHTML } from '../src/ssr/index.js';
import '../src/components/switch/index.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

function elements(source: string): Element[] {
  const pending: Node[] = [...parseFragment(source).childNodes];
  const result: Element[] = [];
  while (pending.length) {
    const node = pending.pop();
    if (!node || !('tagName' in node)) continue;
    result.push(node);
    pending.push(...node.childNodes);
    if (node.tagName === 'template' && 'content' in node) pending.push(...node.content.childNodes);
  }
  return result;
}

function attr(node: Element, name: string): string | undefined {
  return node.attrs.find((entry) => entry.name === name)?.value;
}

function input(source: string): Element {
  const node = elements(source).find((element) => element.tagName === 'input');
  if (!node) throw new Error('Missing Switch input');
  return node;
}

function visibleLabelIds(source: string): string[] {
  const root = elements(source).find(
    (element) => element.tagName === 'label' && attr(element, 'class') === 'root',
  );
  if (!root) throw new Error('Missing Switch root');
  return root.childNodes
    .flatMap((node) => {
      if (!('tagName' in node) || !/\blabel-(?:start|end)\b/.test(attr(node, 'class') ?? ''))
        return [];
      if (attr(node, 'hidden') !== undefined) return [];
      return [attr(node, 'id')];
    })
    .filter((id): id is string => id !== undefined);
}

describe('Switch SSR: подписи и имя существуют до hydration', () => {
  it('передаёт aria-label на реальный input и не создаёт пустую подпись', () => {
    const output = renderToString(html`<lab-switch aria-label="Wi-Fi"></lab-switch>`);
    expect(output).toContain('shadowrootmode');
    expect(attr(input(output), 'aria-label')).toBe('Wi-Fi');
    expect(attr(input(output), 'aria-labelledby')).toBeUndefined();
    expect(visibleLabelIds(output)).toEqual([]);
  });

  it.each([
    [false, false, 2],
    [true, false, 1],
    [false, true, 1],
    [true, true, 0],
  ] as const)(
    'hide start=%s / end=%s: имя содержит только показанные стороны',
    (start, end, count) => {
      const output = renderToString(html`<lab-switch
      label-start="Слева" .hideLabelStart=${start} .hideLabelEnd=${end} aria-label="Резервное имя"
    >Справа</lab-switch>`);
      const ids = visibleLabelIds(output);
      expect(ids).toHaveLength(count);
      expect(new Set(ids).size).toBe(count);
      expect(attr(input(output), 'aria-labelledby')).toBe(ids.length ? ids.join(' ') : undefined);
      expect(attr(input(output), 'aria-label')).toBe(count ? undefined : 'Резервное имя');
      const host = elements(output).find((node) => node.tagName === 'lab-switch');
      if (!host) throw new Error('Missing Switch host');
      const snapshot = Object.fromEntries(JSON.parse(attr(host, 'data-lab-ssr-b1') ?? '[]'));
      expect(snapshot.hideLabelStart).toBe(start);
      expect(snapshot.hideLabelEnd).toBe(end);
    },
  );

  it.each([
    '',
    ' \t\n ',
    '<!-- comment -->',
    '<span slot="icon-on">Icon</span>',
    '<span></span>',
    '<span><em> \t </em><!-- comment --></span>',
  ])('пустой или именованный default %j не создаёт label box', (content) => {
    const output = renderToString(
      html`<lab-switch aria-label="Wi-Fi">${unsafeHTML(content)}</lab-switch>`,
    );
    expect(visibleLabelIds(output)).toEqual([]);
    expect(attr(input(output), 'aria-label')).toBe('Wi-Fi');
  });

  it.each([
    '<span><strong>Legacy</strong> label</span>',
    '<span><img alt="Network" width="16" height="16"></span>',
    '<span aria-label="Network"></span>',
    '<span class="caption">Trailing</span>',
    '<span style="color:currentColor">Trailing</span>',
    '<span style="display:none;display:inline">Trailing</span>',
    `<span style='--caption:"; display:none;";color:black'>Trailing</span>`,
    `<span style='font-family:"; visibility:hidden;"'>Trailing</span>`,
    '<span style="display:n/**/one">Trailing</span>',
    '<span style="dis/**/play:none">Trailing</span>',
    '<span style="--caption:fn(;display:none;);color:black">Trailing</span>',
    String.raw`<span style='--caption:"\";display:none;";color:black'>Trailing</span>`,
    '<span style="--caption:{[fn(;display:none;)]};color:black">Trailing</span>',
    String.raw`<span style="display:none;display:i\6e line">Trailing</span>`,
    '<span style="display:none!important;display:inline !/**/IMPORTANT">Trailing</span>',
    '<span style="visibility:hidden;visibility:initial">Trailing</span>',
    '<span style="display:none;display:flow-root list-item">Trailing</span>',
    ...['\n', '\r\n', '\r', '\f'].map(
      (newline) => `<span style='font-family:"a\\${newline};display:none; b"'>Trailing</span>`,
    ),
    ...[
      'var()',
      'env()',
      'attr()',
      'if()',
      'var(/**/)',
      'var(,inline)',
      'var(foo)',
      'var(--,inline)',
      'var(--caption-display extra)',
      'env(,inline)',
      'attr(,inline)',
      'if(:inline)',
      'var(--x,var())',
      'env(name second)',
      'attr("data-display")',
      'if(foo:inline)',
      'foo(var())',
      'url(var(--x))',
      '1var(--x)',
      '#var(--x)',
      '@var(--x)',
      'attr(data-display type(type(*)))',
      'attr(data-display url(length))',
      'var(--x) {}',
      'attr(data-display type(< length >))',
      'attr(data-display type(<length> +))',
    ].map(
      (value) =>
        `<span style="display:inline;display:${value.replaceAll('"', '&quot;')}">Trailing</span>`,
    ),
    '<span style="display:none;@media{}display:inline">Trailing</span>',
    ...['display:none', 'visibility:hidden', 'content-visibility:hidden'].map(
      (hidden) => `<span style="${hidden};all:initial">Trailing</span>`,
    ),
    ...['display:none', 'visibility:hidden', 'content-visibility:hidden'].map(
      (hidden) => `<span style="all:initial!important;${hidden}">Trailing</span>`,
    ),
    ...['\n', '\r\n', '\r', '\f'].map(
      (newline) => `<span style='font-family:"\\61${newline};display:none; b"'>Trailing</span>`,
    ),
    '<span aria-labelledby="outside">Trailing</span>',
    '<span role="none">Trailing</span>',
    '<span role="img">Trailing</span>',
  ])('сохраняет rich или неизвестное содержимое default %j', (content) => {
    const output = renderToString(
      html`<lab-switch aria-label="Wi-Fi">${unsafeHTML(content)}</lab-switch>`,
    );
    expect(visibleLabelIds(output)).toHaveLength(1);
    expect(attr(input(output), 'aria-labelledby')).toBe(visibleLabelIds(output).join(' '));
    expect(attr(input(output), 'aria-label')).toBeUndefined();
    expect(output).toContain(content);
  });

  it.each([
    '<svg role="img" aria-labelledby="network"><title id="network">Network</title></svg>',
    '<svg role="img" aria-labelledby="network"><title id="network" aria-hidden="true">Network</title></svg>',
  ])('SVG title %j сохраняет обе стороны имени до hydration', (content) => {
    const output = renderToString(
      html`<lab-switch label-start="Leading" aria-label="Wi-Fi">${unsafeHTML(content)}</lab-switch>`,
    );
    expect(visibleLabelIds(output)).toHaveLength(2);
    expect(attr(input(output), 'aria-labelledby')).toBe(visibleLabelIds(output).join(' '));
    expect(attr(input(output), 'aria-label')).toBeUndefined();
    expect(output).toContain(content);
  });

  it.each([
    '<span style="display:none">Trailing</span>',
    '<span style="visibility:hidden">Trailing</span>',
    '<span style="content-visibility:hidden">Trailing</span>',
    '<span aria-hidden="true">Trailing</span>',
    '<span style="display:none;display:unsupported">Trailing</span>',
    '<span style="display:none!important;display:inline">Trailing</span>',
    '<span style="display:/**/none/**/ !/**/important;display:inline">Trailing</span>',
    String.raw`<span style="di\73 play:n\6f ne">Trailing</span>`,
    String.raw`<span style="visibility:h\69 dden">Trailing</span>`,
    '<span style="display:none;display:inline flex grid">Trailing</span>',
    ...['display:none', 'visibility:hidden', 'content-visibility:hidden'].map(
      (hidden) => `<span style="${hidden}!important;all:initial">Trailing</span>`,
    ),
    '<span style="all:initial;display:none">Trailing</span>',
    '<span style="display:none;all:bogus">Trailing</span>',
    '<span style="display:none;all:none">Trailing</span>',
    ...[
      'var(--x,var())',
      'env(name second)',
      'attr("data-display")',
      'if(foo:inline)',
      'foo(var())',
      'url(var(--x))',
      '1var(--x)',
      '#var(--x)',
      '@var(--x)',
      'attr(data-display type(type(*)))',
      'attr(data-display url(length))',
      'var(--x) {}',
      'attr(data-display type(< length >))',
      'attr(data-display type(<length> +))',
    ].map(
      (value) =>
        `<span style="display:none;display:${value.replaceAll('"', '&quot;')}">Trailing</span>`,
    ),
  ])('скрытый caption %j сохраняет fallback без пустого IDREF', (content) => {
    const output = renderToString(
      html`<lab-switch aria-label="Wi-Fi">${unsafeHTML(content)}</lab-switch>`,
    );
    expect(attr(input(output), 'aria-labelledby')).toBeUndefined();
    expect(attr(input(output), 'aria-label')).toBe('Wi-Fi');
    expect(visibleLabelIds(output)).toHaveLength(0);
  });

  it.each([
    '<unknown-switch-label></unknown-switch-label>',
    '<span><unknown-switch-label></unknown-switch-label></span>',
    '<span class="external-icon"></span>',
    '<span style="display:none;display:var(--caption-display)">Trailing</span>',
    '<span style="display:none;display:-webkit-box">Trailing</span>',
    '<span style="display:none;display:math">Trailing</span>',
    '<span style="display:none;display:block ruby">Trailing</span>',
    '<span style="display:none;display:run-in">Trailing</span>',
    '<span style="display:none;display:ruby-base">Trailing</span>',
    '<span style="display:var(--caption-display,)">Trailing</span>',
    '<span style="display:env(safe-area-inset-left)">Trailing</span>',
    '<span style="display:env(viewport-segment-width 0 0)">Trailing</span>',
    '<span style="display:attr(data-display type(&lt;custom-ident&gt;))">Trailing</span>',
    '<span style="display:if(else: inline)">Trailing</span>',
    '<span style="display:none;display:calc(var(--x))">Trailing</span>',
    '<span style="display:none;display:foo(var(--x))">Trailing</span>',
    '<span style="display:none;display:foo(var(--x)">Trailing</span>',
    '<span style="display:none;display:1%var(--x)">Trailing</span>',
    '<span style="display:none;display:{var(--x)}">Trailing</span>',
    '<span style="display:none;display:attr(data-display &lt;custom-ident&gt;)">Trailing</span>',
    '<span style="display:none;display:attr(data-display &quot;&lt;custom-ident&gt;&quot;)">Trailing</span>',
    '<span style="display:none;all:var(--reset)">Trailing</span>',
    '<span style="visibility:hidden;all:inherit">Trailing</span>',
  ])('unknown default %j сохраняется с fallback вместо пустого IDREF', (content) => {
    const output = renderToString(
      html`<lab-switch aria-label="Wi-Fi">${unsafeHTML(content)}</lab-switch>`,
    );
    expect(visibleLabelIds(output)).toHaveLength(1);
    expect(attr(input(output), 'aria-labelledby')).toBeUndefined();
    expect(attr(input(output), 'aria-label')).toBe('Wi-Fi');
    expect(output).toContain(content);
  });

  it('сохраняет старый trailing slot и явный checked=false', () => {
    const output = renderToString(
      html`<lab-switch .defaultChecked=${true} .checked=${false}>Legacy label</lab-switch>`,
    );
    expect(output).toContain('Legacy label');
    expect(
      elements(output).some((node) => node.tagName === 'slot' && attr(node, 'name') === undefined),
    ).toBe(true);
    expect(output).toContain('data-state="unchecked"');
    expect(attr(input(output), 'checked')).toBeUndefined();
  });

  it('выводит уникальные ID двух экземпляров и порядок start → control → end', () => {
    const output = renderToString(
      html`<lab-switch label-start="A">B</lab-switch><lab-switch label-start="C">D</lab-switch>`,
    );
    const labels = elements(output).filter((node) =>
      /\blabel-(?:start|end)\b/.test(attr(node, 'class') ?? ''),
    );
    const ids = labels.map((node) => attr(node, 'id'));
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    for (const root of elements(output).filter((node) => node.tagName === 'label')) {
      const order = root.childNodes.flatMap((node) =>
        'tagName' in node ? [attr(node, 'class') ?? node.tagName] : [],
      );
      expect(order).toEqual(['label-start', 'input', 'control', 'label label-end']);
    }
  });

  it('escaping оставляет labels текстом, а fallback одним атрибутом input', () => {
    const value = '🧪 <b title="x">A & B</b>';
    const output = renderToString(
      html`<lab-switch .labelStart=${value} aria-label=${value} hide-label-end></lab-switch>`,
    );
    expect(output).toContain('&lt;b title=&quot;x&quot;&gt;A &amp; B&lt;/b&gt;');
    expect(elements(output).filter((node) => node.tagName === 'b')).toEqual([]);
    expect(attr(input(output), 'aria-label')).toBeUndefined();
    const fallback = renderToString(html`<lab-switch aria-label=${value}></lab-switch>`);
    expect(attr(input(fallback), 'aria-label')).toBe(value);
    expect(attr(input(fallback), 'aria-labelledby')).toBeUndefined();
  });

  it('меняет только собственные атрибуты и сохраняет маркеры и caller HTML', () => {
    const template = html`${unsafeHTML('<p title="A &amp; B">🧪</p><!-- <lab-switch> --><script>"<lab-switch>"</script>')}<lab-switch aria-label="Wi-Fi" .hideLabelStart=${false}></lab-switch>`;
    const baseline = collectResultSync(render(template));
    const expected = baseline
      .replace(/(<input[^>]*?)aria-labelledby="[^"]*"/, '$1')
      .replace(/(<span class="label label-end"[^>]*)(>)/, '$1 hidden=""$2');
    const output = shapeSwitchLabels(baseline);
    expect(output).toBe(expected);
    expect(shapeSwitchLabels(output)).toBe(output);
  });

  it('не меняет чужую анатомию, HTML в script/style/comment и SVG', () => {
    for (const source of [
      '<p>🧪</p>',
      '<style>/* <lab-switch> */</style><!-- <lab-switch> --><script>"<lab-switch>"</script>',
      '<lab-switch><template shadowrootmode="open"><label class="root">Other implementation</label></template></lab-switch>',
      '<svg><lab-switch><template shadowrootmode="open"><circle r="2"></circle></template></lab-switch></svg>',
    ])
      expect(shapeSwitchLabels(source)).toBe(source);
  });

  it('повреждённая собственная анатомия вызывает явную ошибку', () => {
    const baseline = collectResultSync(render(html`<lab-switch></lab-switch>`));
    expect(() =>
      shapeSwitchLabels(baseline.replace('class="label label-end"', 'class="label unknown-label"')),
    ).toThrow('Switch SSR: отсутствует собственная анатомия');
  });
});
