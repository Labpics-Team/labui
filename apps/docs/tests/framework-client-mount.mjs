import assert from 'node:assert/strict';
import { join } from 'node:path';

export async function checkClientMount(browser, framework, browserName, origin, output) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  try {
    // Observe the real connection boundary; a delayed prop repair cannot pass by
    // merely making the host properties look correct after the machine started.
    await page.addInitScript(() => {
      window.clientConnections = [];
      const define = customElements.define.bind(customElements);
      customElements.define = (name, elementClass, options) => {
        if (name === 'lab-select') {
          const connected = elementClass.prototype.connectedCallback;
          elementClass.prototype.connectedCallback = function () {
            window.clientConnections.push({
              id: this.id,
              label: this.label,
              multiple: this.multiple,
              items: this.items.map((item) => item.value),
              defaultValue: [...this.defaultValue],
              value: this.value === null ? null : [...this.value],
            });
            return connected.call(this);
          };
        }
        return define(name, elementClass, options);
      };
    });
    await page.goto(`${origin}/${framework}/mount.html`);
    await page.waitForFunction(() => window.clientReady);
    const connections = await page.evaluate(() => window.clientConnections);
    assert.deepEqual(
      connections.map((entry) => entry.id),
      ['uncontrolled', 'controlled', 'released'],
    );
    for (const entry of connections) {
      assert.deepEqual(entry.items, ['a', 'b', 'c'], `${framework}: items before connection`);
      assert.deepEqual(entry.defaultValue, ['b'], `${framework}: default before connection`);
      assert.equal(entry.multiple, true, `${framework}: multiple before connection`);
    }
    assert.equal(connections[0].label, 'Uncontrolled');
    assert.equal(connections[0].value, null);
    assert.deepEqual(connections[1].value, ['a']);
    assert.equal(connections[2].value, null);
    const state = (id) =>
      page.locator(`#${id}`).evaluate((node) => ({
        selected: [...node.selectedValues],
        text:
          node.multiple && node.selectedValues.length
            ? [...node.shadowRoot.querySelectorAll('.lab-chip-label')]
                .map((chip) => chip.textContent.trim())
                .join(', ')
            : node.shadowRoot.querySelector('.value-text').textContent.trim(),
      }));
    assert.deepEqual(await state('uncontrolled'), { selected: ['b'], text: 'B' });
    assert.deepEqual(await state('controlled'), { selected: ['a'], text: 'A' });
    assert.deepEqual(await state('released'), { selected: ['b'], text: 'B' });
    await page.locator('#uncontrolled').getByRole('combobox').click();
    await page.locator('#uncontrolled').getByRole('option', { name: 'C', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('#client-events').textContent === 'b,c',
    );
    assert.deepEqual(await state('uncontrolled'), { selected: ['b', 'c'], text: 'B, C' });
    await page.locator('#uncontrolled').getByRole('combobox').click();
    await page.locator('#rename-choice').click();
    await page.waitForFunction(() =>
      document
        .querySelector('#uncontrolled')
        .shadowRoot.querySelector('.lab-select-chips')
        .textContent.includes('Renamed C'),
    );
    assert.deepEqual(await state('uncontrolled'), { selected: ['b', 'c'], text: 'B, Renamed C' });
    await page.locator('#select-c').click();
    await page.waitForFunction(
      () => document.querySelector('#controlled').selectedValues.join(',') === 'c',
    );
    assert.deepEqual(await state('controlled'), { selected: ['c'], text: 'Renamed C' });
    await page.locator('#withdraw-controlled').click();
    await page.waitForFunction(
      () => document.querySelector('#client-control').textContent === 'omitted',
    );
    assert.deepEqual(await page.locator('#controlled').evaluate((node) => node.value), ['c']);
    // Omission stops adapter writes, not the component's explicitly chosen mode.
    // An independent property update must survive another framework render.
    await page.locator('#controlled').evaluate(async (node) => {
      node.value = ['a'];
      await node.updateComplete;
    });
    await page.locator('#change-default').click();
    await page.waitForFunction(
      () => document.querySelector('#uncontrolled').defaultValue.join(',') === 'a',
    );
    assert.deepEqual(await state('controlled'), { selected: ['a'], text: 'A' });
    assert.deepEqual(await state('uncontrolled'), { selected: ['b', 'c'], text: 'B, Renamed C' });
    await page.locator('#clear-controlled').click();
    await page.waitForFunction(
      () => document.querySelector('#controlled').selectedValues.length === 0,
    );
    assert.deepEqual(await state('controlled'), { selected: [], text: 'Choose' });
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: join(output, `${framework}-${browserName}-mount.png`),
      fullPage: true,
    });
    return {
      framework,
      browser: browserName,
      connections,
      uncontrolled: await state('uncontrolled'),
      controlled: await state('controlled'),
      errors,
    };
  } finally {
    await page.close();
  }
}
