import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';
import { build } from 'vite';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const components = [
  'button',
  'input',
  'chip',
  'select',
  'checkbox',
  'radio-group',
  'choicebox',
  'switch',
  'tabs',
  'segmented-control',
  'badge',
  'card',
];
const entry = 'virtual:slot-consumers';
const result = await build({
  configFile: false,
  root,
  logLevel: 'error',
  plugins: [
    {
      name: 'slot-consumer-fixture',
      resolveId(id) {
        if (id === entry) return `\0${entry}`;
      },
      load(id) {
        if (id === `\0${entry}`)
          return `import {slotStyleCss} from '${join(root, 'packages/core/src/slot-projection.ts').replaceAll('\\', '/')}';window.slotStyleCss=slotStyleCss;\n${components
            .map(
              (c, i) =>
                `import * as c${i} from '${join(root, 'packages/core/src/components', c, 'index.ts').replaceAll('\\', '/')}';window.c${i}=c${i};`,
            )
            .join('\n')}`;
      },
    },
  ],
  build: {
    write: false,
    target: 'esnext',
    minify: false,
    rollupOptions: { input: entry, output: { format: 'es', inlineDynamicImports: true } },
  },
});
const script = result.output.find((item) => item.type === 'chunk').code;
const tokens = await readFile(`${root}/packages/core/dist/tokens.css`, 'utf8');
const cases = [
  { tag: 'button', slots: ['icon', 'icon-end'], props: { size: 'l' } },
  { tag: 'button', slots: ['icon'], style: { width: '60px' }, text: 'Long button label' },
  { tag: 'button', slots: ['icon'], roots: 2 },
  { tag: 'input', slots: ['leading', 'trailing'] },
  { tag: 'input', slots: ['leading', 'trailing'], style: { width: '60px' } },
  { tag: 'chip', slots: ['leading'], props: { size: 'm', showLeading: true } },
  {
    tag: 'select',
    slots: ['leading'],
    props: { items: [{ value: 'a', label: 'Option' }], value: ['a'] },
  },
  { tag: 'checkbox', slots: ['icon'], props: { variant: 'card' } },
  { tag: 'checkbox', slots: ['label-start'], kind: 'text', props: { variant: 'card' } },
  {
    tag: 'radio-group',
    slots: ['icon-a'],
    props: { variant: 'card', items: [{ value: 'a', label: 'Option' }] },
  },
  {
    tag: 'choicebox',
    slots: ['icon-a'],
    props: { variant: 'card', items: [{ value: 'a', label: 'Option' }] },
  },
  {
    tag: 'choicebox',
    slots: ['icon-a'],
    props: { variant: 'card', multiple: true, items: [{ value: 'a', label: 'Option' }] },
  },
  { tag: 'switch', slots: ['icon-off'], props: { size: 'l' } },
  { tag: 'switch', slots: ['icon-on'], props: { size: 'l', checked: true } },
  { tag: 'switch', slots: ['label-start'], kind: 'text' },
  {
    tag: 'tabs',
    slots: ['icon-a', 'icon-end-a'],
    props: { items: [{ value: 'a', label: 'Option', icon: 'icon-a', iconEnd: 'icon-end-a' }] },
  },
  {
    tag: 'tabs',
    slots: ['icon-a'],
    props: { items: [{ value: 'a', label: 'Option', icon: 'icon-a', iconOnly: true }] },
  },
  {
    tag: 'segmented-control',
    slots: ['icon-a', 'icon-end-a'],
    props: { items: [{ value: 'a', label: 'Option', icon: 'icon-a', iconEnd: 'icon-end-a' }] },
  },
  {
    tag: 'segmented-control',
    slots: ['icon-a'],
    props: { items: [{ value: 'a', label: 'Option', icon: 'icon-a', iconOnly: true }] },
  },
  { tag: 'badge', slots: ['icon', 'icon-end'] },
  { tag: 'badge', slots: ['dot'], kind: 'dot' },
  { tag: 'badge', slots: ['dot'], kind: 'dot', override: true },
  { tag: 'card', slots: ['media'], kind: 'image' },
  { tag: 'card', slots: ['media'], kind: 'image', override: true },
];
const evidence = [];
for (const [engine, launcher] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await launcher.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(
      `<style>${tokens}body{margin:0}section{width:600px}lab-card{width:600px}lab-choicebox{width:600px}</style>`,
    );
    await page.addScriptTag({ type: 'module', content: script });
    await page.waitForFunction(() => customElements.get('lab-card'));
    for (const font of [16, 32]) {
      for (const [caseIndex, c] of cases.entries()) {
        const data = await page.evaluate(
          async ({ c, font }) => {
            document.documentElement.style.fontSize = `${font}px`;
            document.body.innerHTML = '';
            const output = [];
            for (const projected of [false, true]) {
              const area = document.createElement('section');
              const host = document.createElement(`lab-${c.tag}`);
              Object.assign(host, c.props ?? {});
              Object.assign(host.style, c.style ?? {});
              host.append(c.text ?? 'Label');
              for (const name of c.slots) {
                const content =
                  c.kind === 'image'
                    ? `<img data-probe width="24" height="12" ${c.override ? 'style="height:80px"' : ''} src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2712%27%3E%3C/svg%3E">`
                    : c.kind === 'dot'
                      ? `<span data-probe ${c.override ? 'style="background:rgb(20,30,40);border-radius:1px;margin-inline-end:9px;flex:1"' : ''}></span>`
                      : c.kind === 'text'
                        ? '<span data-probe>UninterruptedLabelThatCanWrapWhenTheControlIsConstrained</span>'
                        : '<svg data-probe width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
                const holder = document.createElement('div');
                holder.innerHTML = projected
                  ? `<lab-slot slot="${name}">${content.repeat(c.roots ?? 1)}</lab-slot>`
                  : content.repeat(c.roots ?? 1);
                if (!projected) for (const child of holder.children) child.slot = name;
                host.append(...holder.children);
              }
              area.append(host);
              document.body.append(area);
              await host.updateComplete;
              await Promise.all([...host.querySelectorAll('img')].map((i) => i.decode()));
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
              output.push(
                [...host.querySelectorAll('[data-probe]')].map((e) => {
                  const r = e.getBoundingClientRect();
                  const s = getComputedStyle(e);
                  return {
                    width: r.width,
                    height: r.height,
                    display: s.display,
                    flex: s.flex,
                    minInlineSize: s.minInlineSize,
                    maxInlineSize: s.maxInlineSize,
                    background: s.backgroundColor,
                    radius: s.borderTopLeftRadius,
                    marginStart: s.marginInlineStart,
                    marginEnd: s.marginInlineEnd,
                  };
                }),
              );
            }
            return output;
          },
          { c, font },
        );
        assert.equal(data[0].length, c.slots.length * (c.roots ?? 1));
        assert.equal(data[1].length, data[0].length);
        for (let i = 0; i < data[0].length; i++) {
          const expected = data[0][i];
          const actual = data[1][i];
          assert.ok(
            expected.width > 0 && expected.height > 0,
            `${engine} ${c.tag} ${c.slots[i]} direct nonzero: ${JSON.stringify(data)}`,
          );
          const { width: _expectedWidth, height: _expectedHeight, ...expectedStyles } = expected;
          const { width: _actualWidth, height: _actualHeight, ...actualStyles } = actual;
          assert.deepEqual(actualStyles, expectedStyles, `${engine} ${c.tag} root styles`);
          if (c.kind === 'dot') {
            assert.notEqual(actual.background, 'rgba(0, 0, 0, 0)');
            assert.ok(Number.parseFloat(actual.radius) > 0);
            assert.ok(Number.parseFloat(actual.marginEnd) > 0);
          }
          assert.ok(
            Math.abs(expected.width - actual.width) < 0.1 &&
              Math.abs(expected.height - actual.height) < 0.1,
            `${engine} ${c.tag} ${c.slots[i]} font${font}: ${JSON.stringify(data)}`,
          );
          if (c.kind === 'image') {
            assert.equal(actual.width, 600);
            assert.equal(actual.height, c.override ? 80 : 300);
          } else if (font === 32 && c.kind !== 'text') {
            const base = evidence.find(
              (record) =>
                record.engine === engine && record.font === 16 && record.caseIndex === caseIndex,
            ).geometry[i];
            assert.ok(
              Math.abs(actual.width - base.width * 2) < 0.1 &&
                Math.abs(actual.height - base.height * 2) < 0.1,
              `${engine} ${c.tag} ${c.slots[i]} scales with root font: ${JSON.stringify({ base, actual })}`,
            );
          }
        }
        evidence.push({
          engine,
          caseIndex,
          font,
          component: c.tag,
          slots: c.slots,
          multiple: c.props?.multiple,
          iconOnly: c.props?.items?.[0].iconOnly,
          kind: c.kind,
          override: c.override,
          geometry: data[1],
        });
      }
    }
    const isolation = await page.evaluate(async () => {
      customElements.define(
        'projection-stage',
        class extends HTMLElement {
          connectedCallback() {
            const inner = this.hasAttribute('inner');
            this.attachShadow({ mode: 'open' }).innerHTML = `<style>${window.slotStyleCss(
              '::slotted(*)',
              {
                'inline-size': inner ? '19px' : '48px',
                'block-size': inner ? '13px' : '48px',
                background: inner ? 'rgb(40, 50, 60)' : 'rgb(10, 20, 30)',
                flex: 'none',
                display: 'inline-block',
              },
            )}</style><slot></slot>`;
          }
        },
      );
      document.body.innerHTML = `<projection-stage><lab-slot>
        <div data-outer>
          <lab-slot><span data-independent style="display:inline-block;width:11px;height:7px"></span></lab-slot>
          <projection-stage inner><lab-slot><span data-inner></span></lab-slot></projection-stage>
        </div>
        <span data-override style="inline-size:17px;block-size:9px;background:rgb(70,80,90);flex:1"></span>
      </lab-slot></projection-stage>`;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return Object.fromEntries(
        ['outer', 'independent', 'inner', 'override'].map((name) => {
          const el = document.querySelector(`[data-${name}]`);
          const rect = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return [
            name,
            { width: rect.width, height: rect.height, background: s.backgroundColor, flex: s.flex },
          ];
        }),
      );
    });
    assert.deepEqual(isolation, {
      outer: { width: 48, height: 48, background: 'rgb(10, 20, 30)', flex: '0 0 auto' },
      independent: { width: 11, height: 7, background: 'rgba(0, 0, 0, 0)', flex: '0 1 auto' },
      inner: { width: 19, height: 13, background: 'rgb(40, 50, 60)', flex: '0 0 auto' },
      override: { width: 17, height: 9, background: 'rgb(70, 80, 90)', flex: '1 1 0%' },
    });
    evidence.push({ engine, component: 'projection-isolation', isolation });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
const output = join(root, 'docs/evidence/alert-20261119/slot-consumers.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.info(
  JSON.stringify({
    passed: evidence.length,
    engines: ['chromium', 'webkit'],
    fontSizes: [16, 32],
    evidence: output,
  }),
);
