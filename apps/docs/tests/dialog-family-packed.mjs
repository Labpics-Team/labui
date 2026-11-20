import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';
import { runPnpm as pnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const consumer = await mkdtemp(join(tmpdir(), 'labui-dialog-'));
const output = join(root, 'docs/evidence/dialog-family-20261120');
let server;
try {
  await mkdir(join(consumer, 'packs'));
  const dependencies = {
    react: '18.3.1',
    'react-dom': '18.3.1',
    lit: '3.3.3',
    '@lit-labs/ssr': '4.1.0',
    '@lit-labs/ssr-client': '1.1.8',
    '@labpics/icons': '0.4.0',
    esbuild: '0.25.0',
    typescript: '5.7.3',
    '@types/react': '18.3.18',
  };
  const overrides = {};
  const archives = [];
  for (const folder of [
    'tokens',
    'shadow',
    'materials',
    'fonts',
    'colors',
    'core',
    'react',
    'vue',
    'solid',
    'svelte',
    'astro',
  ]) {
    const location = join(root, 'packages', folder);
    const pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
    pnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const name = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${name}`;
    archives.push({
      name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', name)))
        .digest('hex'),
    });
  }
  if (process.env.LAB_ICONS_TARBALL) {
    await copyFile(process.env.LAB_ICONS_TARBALL, join(consumer, 'packs/icons.tgz'));
    dependencies['@labpics/icons'] = overrides['@labpics/icons'] = 'file:./packs/icons.tgz';
    archives.push({
      name: 'icons.tgz',
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs/icons.tgz')))
        .digest('hex'),
    });
  }
  await writePackedConsumerProject(consumer, {
    name: 'labui-dialog-consumer',
    dependencies,
    overrides,
  });
  pnpm(['install', '--ignore-scripts', '--prefer-offline'], consumer);
  await writeFile(
    join(consumer, 'shared.mjs'),
    `
    import {createElement as h,useState} from 'react';
    import {Dialog} from '@labpics/ui-react/dialog';
    import {AlertDialog} from '@labpics/ui-react/alert-dialog';
    import {Popover} from '@labpics/ui-react/popover';
    export function App(){const [swap,setSwap]=useState(false);return h('section',{'data-renderer':'react'},
      h('button',{type:'button',onClick:()=>setSwap(!swap)},'Replace React trigger'),
      h(Dialog,{heading:'react task',trigger:({props,ref})=>h('button',{...props,ref,key:String(swap),type:'button'},'react open'),content:h('input',{'aria-label':'react draft',defaultValue:'Draft'})}),
      h(AlertDialog,{heading:'react confirmation',confirmLabel:'react continue',cancelLabel:'react cancel',onConfirm:()=>window.confirms++,children:'react alert'}),
      h(Popover,{heading:'react extra',content:h('input',{'aria-label':'react extra draft',defaultValue:'Extra'}),children:'react popover'}));}
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import {writeFile} from 'node:fs/promises';import {createElement as h} from 'react';import {renderToString} from 'react-dom/server';import {App} from './shared.mjs';
    let html='<div id="react">'+renderToString(h(App))+'</div>';
    for(const renderer of ['vue','solid','svelte','astro']){
      const {renderDialog,renderAlertDialog,renderPopover}=await import('@labpics/ui-'+renderer+'/ssr');
      const trigger=label=>'<button type="button">'+renderer+' '+label+'</button>';
      html+='<section data-renderer="'+renderer+'">'+renderDialog({heading:renderer+' task'},{trigger:trigger('open'),content:'<input aria-label="'+renderer+' draft" value="Draft">'})+
        renderAlertDialog({heading:renderer+' confirmation',confirmLabel:renderer+' continue',cancelLabel:renderer+' cancel'},{trigger:trigger('alert')})+
        renderPopover({heading:renderer+' extra'},{trigger:trigger('popover'),content:'<input aria-label="'+renderer+' extra draft" value="Extra">'})+'</section>';
    }
    await writeFile('index.html','<!doctype html><html data-theme="light" data-material="solid"><head><meta charset="utf-8"><link rel="stylesheet" href="client.css"><style>body{margin:32px;font-family:Geist;background:var(--lab-bg-primary)}section{display:flex;gap:16px;margin-block:24px}</style></head><body>'+html+'<script type="module" src="client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css';import '@labui/colors/contract.css';import '@labpics/ui-core/tokens.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';import {createElement as h} from 'react';import {hydrateRoot} from 'react-dom/client';import {App} from './shared.mjs';
    window.confirms=0;window.hydrate=async()=>{
      await import('@labpics/ui-core/dialog');await import('@labpics/ui-core/alert-dialog');await import('@labpics/ui-core/popover');
      hydrateRoot(document.querySelector('#react'),h(App));
      document.querySelectorAll('lab-alert-dialog').forEach(el=>el.addEventListener('confirm',()=>window.confirms++));
      window.ready=true;
    };
  `,
  );
  await writeFile(
    join(consumer, 'types.mts'),
    `
    import {Dialog,type DialogProps} from '@labpics/ui-react/dialog';
    import {AlertDialog,type AlertDialogProps} from '@labpics/ui-react/alert-dialog';
    import {Popover,type PopoverProps} from '@labpics/ui-react/popover';
    const dialog:DialogProps={heading:'Task',open:false,onOpenChange:()=>{}};
    const alert:AlertDialogProps={confirmLabel:'Continue',pending:true,onConfirm:()=>{}};
    const popover:PopoverProps={placement:'bottom-start',arrow:false};void Dialog;void AlertDialog;void Popover;void dialog;void alert;void popover;
  `,
  );
  pnpm(
    [
      'exec',
      'tsc',
      '--noEmit',
      '--skipLibCheck',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      'types.mts',
    ],
    consumer,
  );
  execFileSync(process.execPath, ['server.mjs'], {
    cwd: consumer,
    stdio: 'pipe',
    windowsHide: true,
  });
  execFileSync(
    process.execPath,
    [
      '-e',
      "require('@labpics/ui-react/alert-dialog');require('@labpics/ui-vue/ssr').renderPopover({heading:'Extra'});",
    ],
    { cwd: consumer, stdio: 'pipe', windowsHide: true },
  );
  pnpm(
    [
      'exec',
      'esbuild',
      'client.js',
      '--bundle',
      '--format=esm',
      '--outdir=public',
      '--loader:.woff2=file',
      '--loader:.webp=file',
      '--loader:.woff=file',
      '--loader:.ttf=file',
    ],
    consumer,
  );
  server = createServer(async (request, response) => {
    const name = decodeURIComponent(request.url.split('?')[0]);
    if (name.includes('..')) return response.writeHead(403).end();
    try {
      const path =
        name === '/' ? join(consumer, 'index.html') : join(consumer, 'public', name.slice(1));
      response.setHeader(
        'Content-Type',
        name.endsWith('.js')
          ? 'text/javascript'
          : name.endsWith('.css')
            ? 'text/css'
            : name.endsWith('.woff2')
              ? 'font/woff2'
              : 'text/html',
      );
      response.end(await readFile(path));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const checks = [];
  for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1100, height: 800 },
        reducedMotion: 'reduce',
      });
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => typeof window.hydrate === 'function');
      await page.evaluate(() => {
        window.drafts = [...document.querySelectorAll('input[aria-label$=" draft"]')];
        for (const input of window.drafts) input.value = 'Preserved before hydration';
        return window.hydrate();
      });
      await page.waitForFunction(() => window.ready);
      for (const renderer of ['react', 'vue', 'solid', 'svelte', 'astro']) {
        const trigger = page.getByRole('button', { name: `${renderer} open`, exact: true });
        if (renderer === 'react')
          await page.getByRole('button', { name: 'Replace React trigger', exact: true }).click();
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: `${renderer} task`, exact: true });
        await dialog.waitFor({ state: 'visible' });
        const input = page.getByRole('textbox', { name: `${renderer} draft`, exact: true });
        assert.equal(await input.inputValue(), 'Preserved before hydration');
        await input.fill('Retained after close');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await trigger.evaluate((el) => el.matches(':focus')), true);
        await trigger.click();
        assert.equal(await input.inputValue(), 'Retained after close');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: `${renderer} alert`, exact: true }).click();
        const alert = page.getByRole('alertdialog', {
          name: `${renderer} confirmation`,
          exact: true,
        });
        await alert.waitFor({ state: 'visible' });
        assert.equal(
          await page
            .getByRole('button', { name: `${renderer} cancel`, exact: true })
            .evaluate((el) => el.matches(':focus')),
          true,
        );
        await page.getByRole('button', { name: `${renderer} continue`, exact: true }).click();
        assert.equal(await alert.isVisible(), true);
        await page.getByRole('button', { name: `${renderer} cancel`, exact: true }).click();
        await page.getByRole('button', { name: `${renderer} popover`, exact: true }).click();
        await page
          .getByRole('dialog', { name: `${renderer} extra`, exact: true })
          .waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        checks.push({
          engine,
          renderer,
          hydration: true,
          drafts: true,
          confirmation: true,
          popover: true,
        });
      }
      assert.equal(await page.evaluate(() => window.confirms), 5);
      assert.equal(
        await page.evaluate(() => window.drafts.every((input) => input.isConnected)),
        true,
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, 'packed.json'),
    `${JSON.stringify({ archives, checks }, null, 2)}\n`,
  );
  console.info('Installed Dialog family SSR, hydration, ESM/CJS and types PASS', checks);
} finally {
  if (server) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  assert.ok(consumer.startsWith(join(tmpdir(), 'labui-dialog-')));
  await rm(consumer, { recursive: true, force: true });
}
