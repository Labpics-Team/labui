import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';
import { build } from 'vite';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = resolve(root, 'docs/evidence/dialog-family-20261120');
await mkdir(output, { recursive: true });
const built = await build({
  configFile: false,
  root: resolve(root, 'apps/docs/src'),
  logLevel: 'error',
  build: {
    write: false,
    rollupOptions: { input: resolve(root, 'apps/docs/src/_fixtures/dialog-family.html') },
  },
});
const assets = new Map(
  built.output.map((f) => [`/${f.fileName}`, f.type === 'chunk' ? f.code : f.source]),
);
const html = [...assets.keys()].find((p) => p.endsWith('.html'));
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = assets.get(path === '/' ? html : path);
  if (file === undefined) return response.writeHead(404).end();
  response.setHeader(
    'content-type',
    path.endsWith('.js')
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.woff2')
          ? 'font/woff2'
          : 'text/html',
  );
  response.end(file);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const results = [];
async function composingEscape(input) {
  await input.evaluate(async (el) => {
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        isComposing: true,
        keyCode: 229,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1100, height: 760 },
        reducedMotion: 'reduce',
      });
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
        console.error('PAGE ERROR', error.message);
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(() => document.fonts.ready);
      for (const renderer of ['Lit', 'React']) {
        const trigger = page.getByRole('button', { name: `${renderer} alert`, exact: true });
        await trigger.click();
        const dialog = page.getByRole('alertdialog');
        await dialog.waitFor({ state: 'visible' });
        assert.equal(await dialog.getAttribute('aria-modal'), 'true');
        await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
        assert.equal(
          await page
            .getByRole('button', { name: 'Cancel', exact: true })
            .evaluate((el) => el.matches(':focus')),
          true,
          'Cancel initial focus',
        );
        const geometry = await dialog.locator('.lab-dialog-content').evaluate((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return { width: r.width, height: r.height, padding: s.padding, radius: s.borderRadius };
        });
        assert.equal(geometry.width, 480);
        console.info('geometry', name, renderer, geometry);
        assert.ok(
          Math.abs(geometry.height - 260) < 0.5,
          'authored height within browser layout precision',
        );
        await dialog.locator('.lab-dialog-content').screenshot({
          path: resolve(output, `${name}-${renderer.toLowerCase()}-source.png`),
        });
        const paint = await page
          .getByRole('button', { name: 'Continue', exact: true })
          .evaluate((el) => {
            const s = getComputedStyle(el);
            return { fill: s.backgroundColor, label: s.color };
          });
        assert.equal(paint.fill, 'rgb(16, 16, 18)');
        assert.equal(paint.label, 'rgb(255, 255, 255)');
        await page.mouse.click(3, 3);
        assert.equal(await dialog.isVisible(), true);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        assert.equal(await dialog.isVisible(), true, 'confirm waits for completion');
        assert.equal(
          await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled(),
          true,
        );
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await trigger.evaluate((el) => el.matches(':focus')), true);
        results.push({ engine: name, renderer, geometry });
      }
      for (const renderer of ['Lit', 'React']) {
        const trigger = page.getByRole('button', { name: `${renderer} dialog`, exact: true });
        await trigger.click();
        const panel = page.getByRole('dialog', { name: 'Настройки', exact: true });
        await panel.waitFor({ state: 'visible' });
        const input = page.getByRole('textbox', { name: `${renderer} dialog draft`, exact: true });
        await input.fill('Saved draft');
        await composingEscape(input);
        assert.equal(
          await panel.isVisible(),
          true,
          'IME Escape preserves the modal after native cancel',
        );
        const nestedTrigger = page.getByRole('button', {
          name: `${renderer} nested popover`,
          exact: true,
        });
        await nestedTrigger.click();
        const child = page.getByRole('dialog', { name: 'Дополнительно', exact: true });
        await child.waitFor({ state: 'visible' });
        await page
          .getByRole('textbox', { name: `${renderer} nested draft`, exact: true })
          .fill('Nested draft');
        await composingEscape(
          page.getByRole('textbox', { name: `${renderer} nested draft`, exact: true }),
        );
        assert.equal(await panel.isVisible(), true, 'nested IME Escape preserves the parent modal');
        assert.equal(await child.isVisible(), true, 'nested IME Escape preserves the child panel');
        await page.keyboard.press('Escape');
        await child.waitFor({ state: 'hidden' });
        assert.equal(await panel.isVisible(), true, 'child Escape preserves parent');
        assert.equal(await nestedTrigger.evaluate((el) => el.matches(':focus')), true);
        await nestedTrigger.click();
        assert.equal(
          await page
            .getByRole('textbox', { name: `${renderer} nested draft`, exact: true })
            .inputValue(),
          'Nested draft',
        );
        await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
        await panel.waitFor({ state: 'hidden' });
        await child.waitFor({ state: 'hidden' });
        assert.equal(await trigger.evaluate((el) => el.matches(':focus')), true);
        await trigger.click();
        assert.equal(await input.inputValue(), 'Saved draft');
        assert.equal(await child.isVisible(), false);
        await page.keyboard.press('Escape');
        await panel.waitFor({ state: 'hidden' });
        assert.equal(await trigger.evaluate((el) => el.matches(':focus')), true);
        results.push({ engine: name, renderer, nested: true, draftPreserved: true });
      }
      for (const renderer of ['Lit', 'React']) {
        const trigger = page.getByRole('button', { name: `${renderer} popover`, exact: true });
        await trigger.click();
        const panel = page.getByRole('dialog');
        await panel.waitFor({ state: 'visible' });
        const bounds = await panel.locator('.lab-dialog-content').boundingBox();
        assert.ok(bounds.x >= 16 && bounds.x + bounds.width <= 1084);
        assert.ok(bounds.y >= 16 && bounds.y + bounds.height <= 744);
        assert.equal(await panel.getAttribute('aria-modal'), 'false');
        const popoverInput = page.getByRole('textbox', {
          name: renderer === 'Lit' ? 'Popover draft' : 'React popover draft',
          exact: true,
        });
        await popoverInput.focus();
        await composingEscape(popoverInput);
        assert.equal(await panel.isVisible(), true, 'IME Escape does not dismiss');
        if (renderer === 'Lit') {
          const theme = await panel
            .locator('.lab-dialog-content')
            .evaluate((el) => getComputedStyle(el).getPropertyValue('--lab-label-primary').trim());
          assert.match(theme, /246|248|250/, 'local theme survives transformed clipped ancestor');
          await page.evaluate(() => {
            const popover = document.querySelector('#lit-popover');
            popover.placement = 'right';
            popover.arrow = false;
          });
          await page.waitForFunction(
            () =>
              !document
                .querySelector('#lit-popover')
                .shadowRoot.querySelector('.lab-popover-arrow'),
          );
          await page.waitForFunction(
            () =>
              document.querySelector('#lit-popover').shadowRoot.querySelector('[part="positioner"]')
                .dataset.side === 'right',
          );
          await page.evaluate(() => {
            document.querySelector('#lit-popover').arrow = true;
          });
          await page.waitForFunction(() =>
            Boolean(
              document.querySelector('#lit-popover').shadowRoot.querySelector('.lab-popover-arrow')
                ?.style.top,
            ),
          );
        }
        await page.getByRole('textbox', { name: 'Outside input', exact: true }).click();
        await panel.waitFor({ state: 'hidden' });
        assert.equal(
          await page
            .getByRole('textbox', { name: 'Outside input', exact: true })
            .evaluate((el) => el.matches(':focus')),
          true,
        );
      }
      await page.evaluate(() => {
        const dialog = document.createElement('lab-dialog');
        dialog.id = 'conditional';
        dialog.heading = 'Conditional slot';
        dialog.closable = false;
        const trigger = document.createElement('lab-slot');
        trigger.slot = 'trigger';
        trigger.innerHTML = '<button type="button">Projected trigger</button>';
        const content = document.createElement('lab-slot');
        content.slot = 'content';
        content.append(document.createComment('v-if'));
        dialog.append(trigger, content);
        document.body.append(dialog);
      });
      await page.getByRole('button', { name: 'Projected trigger', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'Conditional slot', exact: true })
        .waitFor({ state: 'visible' });
      assert.equal(
        await page.evaluate(
          () =>
            document.querySelector('#conditional').shadowRoot.querySelector('[part="body"]').hidden,
        ),
        true,
      );
      await page.evaluate(() => {
        document.querySelector('#conditional lab-slot[slot="content"]').innerHTML =
          '<input aria-label="Conditional draft">';
      });
      await page.getByRole('textbox', { name: 'Conditional draft' }).waitFor({ state: 'visible' });
      await page.evaluate(() => {
        document.querySelector('#conditional lab-slot[slot="content"]').replaceChildren();
      });
      await page.waitForFunction(
        () =>
          document.querySelector('#conditional').shadowRoot.querySelector('[part="body"]').hidden,
      );
      await page.keyboard.press('Escape');
      await page
        .getByRole('dialog', { name: 'Conditional slot', exact: true })
        .waitFor({ state: 'hidden' });
      await page.evaluate(() => {
        document.querySelector('#conditional lab-slot[slot="trigger"]').innerHTML =
          '<button type="button">Replacement trigger</button>';
      });
      await page.getByRole('button', { name: 'Replacement trigger', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'Conditional slot', exact: true })
        .waitFor({ state: 'visible' });
      await page.evaluate(() => document.querySelector('#conditional').remove());
      assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.getByRole('button', { name: 'Lit alert', exact: true }).click();
      await page.getByRole('alertdialog').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(
        await page.getByRole('alertdialog').isVisible(),
        true,
        'dialog remains present during exit',
      );
      await page.evaluate(() => {
        document.querySelector('#lit-alert').open = true;
      });
      await page.getByRole('alertdialog').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const theme of ['light', 'dark'])
        for (const material of ['solid', 'glass', 'acrylic'])
          for (const scale of [1, 1.25, 2]) {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.evaluate(
              ({ theme, material, scale }) => {
                document.documentElement.dataset.theme = theme;
                document.documentElement.dataset.material = material;
                document.documentElement.style.fontSize = `${16 * scale}px`;
              },
              { theme, material, scale },
            );
            await page.getByRole('button', { name: 'Lit alert', exact: true }).click();
            const panel = page.getByRole('alertdialog');
            const layout = await panel.locator('.lab-dialog-content').evaluate((el) => {
              const r = el.getBoundingClientRect();
              return {
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                client: el.clientWidth,
                scroll: el.scrollWidth,
              };
            });
            assert.ok(layout.x >= 16 && layout.x + layout.width <= 374);
            assert.ok(layout.y >= 16 && layout.y + layout.height <= 828);
            assert.equal(layout.scroll, layout.client, 'no horizontal scroll at enlarged type');
            await page
              .getByRole('button', { name: 'Cancel', exact: true })
              .scrollIntoViewIfNeeded();
            if (scale === 2)
              await panel.locator('.lab-dialog-content').screenshot({
                path: resolve(output, `${name}-${theme}-${material}-narrow-200.png`),
              });
            await page.getByRole('button', { name: 'Cancel', exact: true }).click();
            results.push({ engine: name, theme, material, scale, layout });
          }
      for (const scale of [1, 2]) {
        await page.evaluate((scale) => {
          document.documentElement.dataset.theme = 'light';
          document.documentElement.dataset.material = 'solid';
          document.documentElement.style.fontSize = `${16 * scale}px`;
          document.querySelector('#lit-dialog').heading = 'Настройки пространства';
          document.querySelector('#lit-popover').heading = 'Дополнительные настройки';
        }, scale);
        for (const component of ['dialog', 'popover']) {
          await page.getByRole('button', { name: `Lit ${component}`, exact: true }).click();
          const panel = page.getByRole('dialog');
          await panel.evaluate(
            () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
          );
          const bounds = await panel.locator('.lab-dialog-content').boundingBox();
          assert.ok(
            bounds.x >= 16 && bounds.x + bounds.width <= 374,
            'top-layer panel stays inside viewport despite clipping ancestors',
          );
          assert.ok(
            bounds.y >= 16 && bounds.y + bounds.height <= 828,
            'top-layer panel keeps usable viewport height',
          );
          await panel.locator('.lab-dialog-content').screenshot({
            path: resolve(output, `${name}-${component}-${scale * 100}.png`),
          });
          const layout = await panel
            .locator('.lab-dialog-content')
            .evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
          assert.equal(layout.scroll, layout.client, 'adaptive heading has no horizontal overflow');
          await page.keyboard.press('Escape');
          await panel.waitFor({ state: 'hidden' });
        }
      }
      assert.deepEqual(errors, []);
      await page.close();
    } finally {
      await browser.close();
    }
  }
  await writeFile(resolve(output, 'web.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.info('Dialog family source and confirmation paths PASS', results);
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
