import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Choicebox } from '@labpics/ui-react/choicebox';
import { Radio, RadioGroup } from '@labpics/ui-react/radio-group';
import { SegmentedControl } from '@labpics/ui-react/segmented-control';
import { renderSegmentedControl } from '@labpics/ui-vue/ssr';
import { chromium, expect, webkit } from '@playwright/test';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vite/package.json'));
const { build } = await import(pathToFileURL(viteRequire.resolve('esbuild')).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const items = ['a', 'b', 'c'].map((value) => ({ value, label: value.toUpperCase() }));
const models = [
  'segmented-one',
  'segmented-two',
  'segmented-empty',
  'radio',
  'choice-one',
  'choice-many',
];
const shared = `
import {createElement as h} from 'react';
import {SegmentedControl} from '@labpics/ui-react/segmented-control';
import {Radio,RadioGroup} from '@labpics/ui-react/radio-group';
import {Choicebox} from '@labpics/ui-react/choicebox';
const items=${JSON.stringify(items)};
export const tree=()=>h('div',null,...${JSON.stringify(models)}.map(model=>h('form',{'data-react-model':model,key:model},
model.startsWith('segmented')?h(SegmentedControl,{items,defaultValue:model.endsWith('empty')?null:'a',required:true,label:model}):
model==='radio'?h(RadioGroup,{defaultValue:'a',required:true,label:model},...items.map(item=>h(Radio,{value:item.value,key:item.value},item.label))):
h(Choicebox,{items,defaultValue:['a'],required:true,multiple:model==='choice-many',label:model}))));
`;
const reactTree = () =>
  h(
    'div',
    null,
    ...models.map((model) =>
      h(
        'form',
        { 'data-react-model': model, key: model },
        model.startsWith('segmented')
          ? h(SegmentedControl, {
              items,
              defaultValue: model.endsWith('empty') ? null : 'a',
              required: true,
              label: model,
            })
          : model === 'radio'
            ? h(
                RadioGroup,
                { defaultValue: 'a', required: true, label: model },
                ...items.map((item) =>
                  h(Radio, { value: item.value, key: item.value }, item.label),
                ),
              )
            : h(Choicebox, {
                items,
                defaultValue: ['a'],
                required: true,
                multiple: model === 'choice-many',
                label: model,
              }),
      ),
    ),
  );
const script = await build({
  stdin: {
    resolveDir: resolve(root, 'apps/docs'),
    loader: 'js',
    contents: `
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import {createRoot,hydrateRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {useState} from 'react';
${shared}
const setters={};
function Binding({model}){const[name,setName]=useState();setters[model]=setName;
const props={name,required:true,label:'Binding'};return h('form',{'data-binding':model},
model==='segmented'?h(SegmentedControl,{...props,items}):
model==='radio'?h(RadioGroup,props,...items.map(item=>h(Radio,{value:item.value,key:item.value},item.label))):
h(Choicebox,{...props,items,multiple:model==='choice-many'}));}
window.mountBindings=()=>{
  const node=document.createElement('section');document.body.append(node);
  const forms=['segmented','radio','choice-one','choice-many'].map(model=>h(Binding,{model,key:model}));
  flushSync(()=>createRoot(node).render(h('div',null,...forms)));
};
window.setNames=named=>flushSync(()=>Object.values(setters).forEach(setter=>setter(named?'choice':undefined)));
window.hydrate=async()=>{
  await import('@labpics/ui-core/segmented-control');
  await import('@labpics/ui-core/radio-group');await import('@labpics/ui-core/choicebox');
  const updates=await Promise.all([...document.querySelectorAll('lab-segmented-control')].map(node=>node.updateComplete));
  const settled=[...document.querySelectorAll('lab-segmented-control')].map(node=>({value:node.selectedValue,selected:[...node.shadowRoot.querySelectorAll('[data-selected] input')].map(input=>input.value),tabStops:[...node.shadowRoot.querySelectorAll('input[tabindex="0"]')].map(input=>input.value)}));
  hydrateRoot(document.getElementById('react'),tree());
  return {updates,settled};
};`,
  },
  bundle: true,
  tsconfigRaw: '{}',
  loader: { '.css': 'empty' },
  write: false,
  format: 'esm',
  logLevel: 'silent',
});
const css = (
  await Promise.all(
    ['segmented-control.css', 'selection-controls.css'].map((file) =>
      readFile(require.resolve(`@labpics/ui-core/${file}`), 'utf8'),
    ),
  )
).join('\n');
const html = `<!doctype html><html><head><style>:root{--lab-control-bg:white;--lab-fill-quaternary:#eee;--lab-label-primary:black;--lab-label-secondary:#555;--lab-border-base:#ddd}body{background:#ccc}form{width:370px;margin:10px}</style><style>${css}</style></head><body><section id="react">${renderToString(reactTree())}</section><form data-lit="named">${renderSegmentedControl({ items, name: 'period', defaultValue: 'a', required: true, label: 'Lit named' })}</form><form data-lit="unnamed">${renderSegmentedControl({ items, defaultValue: 'a', required: true, label: 'Lit unnamed' })}</form><script type="module" src="/client.js"></script></body></html>`;
const server = createServer((request, response) =>
  request.url === '/client.js'
    ? response.setHeader('Content-Type', 'text/javascript').end(script.outputFiles[0].text)
    : response.end(html),
);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const records = [];
try {
  for (const [engine, kind] of Object.entries({ chromium, webkit })) {
    const browser = await kind.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => typeof window.hydrate === 'function');
      for (const group of await page.locator('form').all()) {
        const inputs = group.locator('input');
        await inputs.evaluateAll((inputs) => {
          for (const input of inputs) {
            input.__original = true;
            input.__initialName = input.name;
          }
        });
        if ((await group.getAttribute('data-react-model')) === 'segmented-empty') continue;
        const role = (await group.locator('input[type="checkbox"]').count()) ? 'checkbox' : 'radio';
        await group.getByRole(role, { name: 'C', exact: true }).locator('..').click();
        await group.getByRole(role, { name: 'B', exact: true }).locator('..').click();
      }
      const snapshot = () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('form'), (form) => {
            const host = form.querySelector('lab-segmented-control');
            const scope = host?.shadowRoot ?? form;
            const inputs = Array.from(scope.querySelectorAll('input'));
            const b = inputs.find((input) => input.value === 'b');
            return {
              model: form.dataset.reactModel ?? `lit-${form.dataset.lit}`,
              checked: inputs.filter((input) => input.checked).map((input) => input.value),
              selected: inputs
                .filter((input) => input.closest('label')?.hasAttribute('data-selected'))
                .map((input) => input.value),
              tabStops: inputs.filter((input) => input.tabIndex === 0).map((input) => input.value),
              form: Array.from(new FormData(form)),
              valid: form.checkValidity(),
              associated: inputs.some((input) => input.form !== null),
              stable: inputs.every(
                (input) => input.__original && input.name === input.__initialName,
              ),
              activeB: b?.closest('label')?.querySelector('.lab-segment-active')
                ? getComputedStyle(b.closest('label').querySelector('.lab-segment-active'))
                    .backgroundColor
                : null,
              selectionStrokeB: b?.closest('[data-lab-selection]')
                ? getComputedStyle(b.closest('[data-lab-selection]'))
                    .getPropertyValue('--_selection-stroke')
                    .trim()
                : null,
            };
          }),
        );
      const before = await snapshot();
      await page.locator('form:not([data-lit="named"])').evaluateAll((forms) => {
        for (const form of forms) form.reset();
      });
      assert.deepEqual(
        await snapshot(),
        before,
        `${engine}: unnamed native reset before hydration`,
      );
      const completed = await page.evaluate(async () => {
        const result = await window.hydrate();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return result;
      });
      const after = await snapshot();
      await page.locator('form:not([data-lit="named"])').evaluateAll(async (forms) => {
        for (const form of forms) form.reset();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      assert.deepEqual(await snapshot(), after, `${engine}: unnamed reset after hydration`);
      records.push({ engine, before, after, completed, errors });
      for (const phase of [before, after])
        for (const group of phase) {
          assert.deepEqual(
            group.checked,
            group.model === 'segmented-empty'
              ? []
              : group.model === 'choice-many'
                ? ['a', 'b', 'c']
                : ['b'],
            `${engine}/${group.model}: exclusive early input`,
          );
          assert.deepEqual(
            group.form,
            phase === after && group.model === 'lit-named' ? [['period', 'b']] : [],
            `${engine}/${group.model}: form association`,
          );
          if (
            group.model !== 'segmented-empty' &&
            (group.model.startsWith('segmented') || group.model.startsWith('lit'))
          )
            assert.notEqual(
              group.activeB,
              'rgba(0, 0, 0, 0)',
              `${engine}/${group.model}: early appearance`,
            );
          assert.equal(group.stable, true, `${engine}/${group.model}: node and name identity`);
          if (group.selectionStrokeB !== null)
            assert.equal(
              group.selectionStrokeB,
              'transparent',
              `${engine}/${group.model}: early native appearance`,
            );
          assert.equal(
            group.valid,
            true,
            `${engine}/${group.model}: parent form ignores unnamed required`,
          );
          if (!group.model.startsWith('lit'))
            assert.equal(
              group.associated,
              false,
              `${engine}/${group.model}: no native form association`,
            );
        }
      for (const group of after) {
        assert.deepEqual(
          group.selected,
          group.checked,
          `${engine}/${group.model}: selected projection`,
        );
        if (group.model !== 'choice-many')
          assert.deepEqual(
            group.tabStops,
            group.model === 'segmented-empty' ? ['a'] : ['b'],
            `${engine}/${group.model}: tab stop`,
          );
      }
      assert.deepEqual(completed, {
        updates: [true, true],
        settled: [
          { value: 'b', selected: ['b'], tabStops: ['b'] },
          { value: 'b', selected: ['b'], tabStops: ['b'] },
        ],
      });
      await page.evaluate(() => window.mountBindings());
      const bindingState = () =>
        page.locator('[data-binding]').evaluateAll((forms) =>
          forms.map((form) => ({
            model: form.dataset.binding,
            valid: form.checkValidity(),
            values: Array.from(new FormData(form)),
            checked: Array.from(form.querySelectorAll('input:checked'), (input) => input.value),
          })),
        );
      assert.ok((await bindingState()).every((form) => form.valid && form.values.length === 0));
      await page.evaluate(() => window.setNames(true));
      assert.ok((await bindingState()).every((form) => !form.valid));
      await page.locator('[data-binding]').evaluateAll((forms) => {
        for (const form of forms) form.querySelector('input[value="b"]').click();
      });
      const named = await bindingState();
      assert.ok(
        named.every(
          (form) => form.valid && JSON.stringify(form.values) === JSON.stringify([['choice', 'b']]),
        ),
      );
      await page.locator('[data-binding]').evaluateAll(async (forms) => {
        for (const form of forms) form.reset();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      await expect
        .poll(async () =>
          (await bindingState()).every((form) => !form.valid && form.checked.length === 0),
        )
        .toBe(true);
      await page.locator('[data-binding]').evaluateAll((forms) => {
        for (const form of forms) form.querySelector('input[value="b"]').click();
      });
      await page.evaluate(() => window.setNames(false));
      await page.locator('[data-binding]').evaluateAll(async (forms) => {
        for (const form of forms) form.reset();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      assert.ok(
        (await bindingState()).every(
          (form) =>
            form.valid && form.values.length === 0 && JSON.stringify(form.checked) === '["b"]',
        ),
      );
      const litBindings = await page.evaluate(async () => {
        const results = [];
        for (const model of [
          'segmented-control',
          'radio-group',
          'choicebox',
          'choicebox-multiple',
        ]) {
          const form = document.createElement('form');
          const control = document.createElement(
            model === 'choicebox-multiple' ? 'lab-choicebox' : `lab-${model}`,
          );
          control.items = [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ];
          control.required = true;
          control.multiple = model === 'choicebox-multiple';
          form.append(control);
          document.body.append(form);
          await control.updateComplete;
          const standalone = form.checkValidity();
          control.name = 'choice';
          await control.updateComplete;
          const required = !form.checkValidity();
          control.value = model.startsWith('choicebox') ? ['b'] : 'b';
          await control.updateComplete;
          const named = Array.from(new FormData(form));
          control.name = '';
          await control.updateComplete;
          form.reset();
          await control.updateComplete;
          const kept = model === 'segmented-control' ? control.selectedValue : control.value;
          results.push({
            model,
            standalone,
            required,
            named,
            kept,
            standaloneValues: Array.from(new FormData(form)),
          });
          form.remove();
        }
        return results;
      });
      for (const result of litBindings) {
        assert.equal(result.standalone, true);
        assert.equal(result.required, true);
        assert.deepEqual(result.named, [['choice', 'b']]);
        assert.deepEqual(result.standaloneValues, []);
        assert.deepEqual(result.kept, result.model.startsWith('choicebox') ? ['b'] : 'b');
      }
      records.at(-1).formBinding = { react: named, lit: litBindings };
      assert.deepEqual(errors, []);
      process.stdout.write(
        `${engine}: early selection, standalone forms and settled hydration passed\n`,
      );
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    resolve(root, 'docs/evidence/segmented-20261119/hydration.json'),
    `${JSON.stringify(records, null, 2)}\n`,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
