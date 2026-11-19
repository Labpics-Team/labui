import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vite/package.json'));
const { build } = await import(pathToFileURL(viteRequire.resolve('esbuild')).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const built = await build({
  stdin: {
    resolveDir: resolve(root, 'apps/docs'),
    loader: 'jsx',
    contents: `
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {Checkbox} from '@labpics/ui-react/checkbox';import {RadioGroup,Radio} from '@labpics/ui-react/radio-group';
  import {Choicebox} from '@labpics/ui-react/choicebox';import {SegmentedControl} from '@labpics/ui-react/segmented-control';
  import {listenSelectionReset} from '@labpics/ui-core/selection/runtime';window.resetHelper=listenSelectionReset;
  const items=[{value:'a',label:'A'},{value:'b',label:'B'}];window.requests={};
  const record=(key)=>(value)=>{(window.requests[key]??=[]).push(value)};
  function Demo(){return <>{[false,true].flatMap(controlled=>['checkbox','radio','choice-one','choice-many','segmented'].map(model=>{
    const key=model+(controlled?'-controlled':'');const formProps={'data-model':key};
    const common={name:'item',label:'Selection',onValueChange:record(key)};
    return <form {...formProps} key={key}>
      {model==='checkbox'?<Checkbox name="item" value="a" defaultChecked={true} {...(controlled?{checked:true}:{})} onCheckedChange={record(key)}>A</Checkbox>:
       model==='radio'?<RadioGroup {...common} defaultValue="a" {...(controlled?{value:'a'}:{})}><Radio value="a">A</Radio><Radio value="b">B</Radio></RadioGroup>:
       model==='segmented'?<SegmentedControl {...common} items={items} defaultValue="a" {...(controlled?{value:'a'}:{})}/>:
       <Choicebox {...common} items={items} defaultValue={['a']} multiple={model==='choice-many'} {...(controlled?{value:['a']}:{})}/>}
      <button type="reset">Reset</button>
    </form>;
  }))}</>};createRoot(document.getElementById('root')).render(<Demo/>);
`,
  },
  bundle: true,
  tsconfigRaw: '{}',
  loader: { '.css': 'empty' },
  write: false,
  format: 'esm',
  logLevel: 'silent',
});
const script = built.outputFiles[0].text;
const server = createServer((request, response) => {
  if (request.url === '/client.js')
    response.setHeader('Content-Type', 'text/javascript').end(script);
  else
    response.end(
      '<!doctype html><html><body><div id="root"></div><script type="module" src="/client.js"></script></body></html>',
    );
});
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
      await expect(page.locator('form')).toHaveCount(10);
      for (const controlled of [false, true])
        for (const model of ['checkbox', 'radio', 'choice-one', 'choice-many', 'segmented']) {
          const key = model + (controlled ? '-controlled' : '');
          const form = page.locator(`[data-model="${key}"]`);
          if (model === 'choice-many' || model === 'checkbox')
            await form
              .locator('label')
              .filter({ has: page.locator('input[value="a"]') })
              .click();
          if (model !== 'checkbox')
            await form
              .locator('label')
              .filter({ has: page.locator('input[value="b"]') })
              .click();
          const before = await page.evaluate((key) => window.requests[key]?.length ?? 0, key);
          await form.evaluate((form) => {
            form.reset();
            (
              form.querySelector('input[value="b"]') ?? form.querySelector('input[value="a"]')
            ).click();
          });
          const expected = controlled
            ? ['a']
            : model === 'checkbox'
              ? []
              : model === 'choice-many'
                ? ['a', 'b']
                : ['b'];
          await expect
            .poll(() =>
              form.evaluate((form) =>
                Array.from(form.querySelectorAll('input:checked'), (input) => input.value),
              ),
            )
            .toEqual(expected);
          await expect
            .poll(() => page.evaluate((key) => window.requests[key]?.length ?? 0, key))
            .toBe(before + 1);
          const after = await form.evaluate((form) =>
            [...new FormData(form)].map((entry) => entry[1]),
          );
          assert.deepEqual(after, expected, `${engine}/${key}: form value`);
          await form.evaluate(async (form) => {
            const parent = form.parentElement;
            parent.addEventListener('reset', (event) => event.preventDefault(), { once: true });
            form.reset();
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
          assert.deepEqual(
            await form.evaluate((form) =>
              Array.from(form.querySelectorAll('input:checked'), (input) => input.value),
            ),
            expected,
          );
        }
      const lifecycle = await page.evaluate(async () => {
        const result = [];
        for (const mode of [
          'input supersedes reset',
          'ancestor cancels reset',
          'disposed before timer',
        ]) {
          const parent = document.createElement('div');
          parent.innerHTML = '<form><input type="checkbox" checked></form>';
          document.body.append(parent);
          const form = parent.querySelector('form');
          const input = form.querySelector('input');
          input.checked = false;
          let callbacks = 0;
          const dispose = window.resetHelper(input, () => {
            callbacks++;
            input.checked = true;
          });
          if (mode === 'ancestor cancels reset')
            parent.addEventListener('reset', (event) => event.preventDefault());
          form.reset();
          if (mode === 'disposed before timer') dispose();
          else if (mode === 'input supersedes reset') input.click();
          await new Promise((resolve) => setTimeout(resolve, 0));
          result.push({ mode, callbacks, checked: input.checked });
          dispose();
          parent.remove();
        }
        return result;
      });
      assert.deepEqual(lifecycle, [
        { mode: 'input supersedes reset', callbacks: 0, checked: false },
        { mode: 'ancestor cancels reset', callbacks: 0, checked: false },
        { mode: 'disposed before timer', callbacks: 0, checked: true },
      ]);
      assert.deepEqual(errors, []);
      records.push({
        engine,
        browser: browser.version(),
        models: ['Checkbox', 'RadioGroup', 'Choicebox single/multiple', 'SegmentedControl'],
        controlledRefusal: true,
        sameTaskResetClick: true,
        lateResetCancellation: true,
        lifecycle,
        errors,
      });
    } finally {
      await browser.close();
    }
  }
  const output = resolve(root, 'docs/evidence/segmented-20261119');
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'selection-reset.json'), `${JSON.stringify(records, null, 2)}\n`);
  process.stdout.write(
    'Selection reset: native input, same-task click, late cancellation and disposal passed in Chromium/WebKit',
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
