import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeCore } from '../src/analyze.js';

function analyze(files: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), 'labui-codegen-registration-'));
  try {
    for (const [path, source] of Object.entries(files)) {
      const file = join(directory, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, source);
    }
    return analyzeCore(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const implementation = {
  'shared/ancestor.ts': `
export class Ancestor extends HTMLElement {
  static properties: Record<string, unknown> = {
    heading: { type: String, attribute: 'accessible-heading' },
    disabled: { type: String, attribute: 'legacy-disabled' },
  };
  notify() { this.dispatchEvent(new CustomEvent('ancestor-change')); }
  render() { return '<slot></slot><slot name="leading"></slot>'; }
}
`,
  'probe/implementation.ts': `
import { Ancestor as Parent } from '../shared/ancestor.js';
export class ActualElement extends Parent {
  static properties: Record<string, unknown> = {
    disabled: { type: Boolean },
    payload: { attribute: false },
  };
  notifyOwn() { this.dispatchEvent(new CustomEvent('value-change')); }
  render() { return '<slot name="body"></slot>'; }
}
`,
  'probe/bridge.ts': "export { ActualElement as Forwarded } from './implementation.js';",
};

describe('публичная регистрация → потребительский манифест', () => {
  it('сохраняет регистрацию внутри функции рядом с классом', () => {
    expect(
      analyze({
        'control/index.ts': "export { Minimal, register } from './lab-control.js';",
        'control/lab-control.ts': `
export class Minimal extends HTMLElement {
  static properties = { value: { type: String } };
}
export function register() { customElements.define('lab-control', Minimal); }
`,
      }),
    ).toEqual({
      version: 1,
      components: [
        {
          tag: 'lab-control',
          subpath: 'control',
          pascal: 'Control',
          className: 'Minimal',
          props: [{ name: 'value', attr: 'value', kind: 'string' }],
          events: [],
          slots: { default: false, named: [], dynamic: false },
        },
      ],
    });
  });

  it('наследует размерное заполнение слотов без собственного render', () => {
    expect(
      analyze({
        'shared/ancestor.ts': `
export class Ancestor extends HTMLElement {
  render() {
    return '<slot name="leading" data-sizing="fill"></slot><slot name="body"></slot>';
  }
}
`,
        'probe/index.ts': `
import { Ancestor } from '../shared/ancestor.js';
export class Probe extends Ancestor {}
customElements.define('lab-probe', Probe);
`,
      }),
    ).toEqual({
      version: 1,
      components: [
        {
          tag: 'lab-probe',
          subpath: 'probe',
          pascal: 'Probe',
          className: 'Probe',
          props: [],
          events: [],
          slots: { default: false, named: ['body', 'leading'], dynamic: false, fill: ['leading'] },
        },
      ],
    });
  });

  it.each([
    {
      name: 'класс в соседнем файле',
      entry: `
import { ActualElement } from './implementation.js';
export { ActualElement };
customElements.define('lab-probe', ActualElement);
`,
      className: 'ActualElement',
    },
    {
      name: 'псевдоним импорта',
      entry: `
import { ActualElement as Registered } from './implementation.js';
export { ActualElement } from './implementation.js';
customElements.define('lab-probe', Registered);
`,
      className: 'ActualElement',
    },
    {
      name: 'публичный псевдоним экспорта',
      entry: `
import { ActualElement as Registered } from './implementation.js';
export { ActualElement as PublicElement } from './implementation.js';
customElements.define('lab-probe', Registered);
`,
      className: 'PublicElement',
    },
    {
      name: 'цепочка реэкспортов',
      entry: `
import { Forwarded as Registered } from './bridge.js';
export { Forwarded as PublicElement } from './bridge.js';
customElements.define('lab-probe', Registered);
`,
      className: 'PublicElement',
    },
    {
      name: 'исходное имя сохраняется при дополнительном псевдониме',
      entry: `
import { ActualElement } from './implementation.js';
export { ActualElement, ActualElement as Alternative };
customElements.define('lab-probe', ActualElement);
`,
      className: 'ActualElement',
    },
  ])('$name сохраняет свойства, события и слоты настоящего класса', ({ entry, className }) => {
    expect(analyze({ ...implementation, 'probe/index.ts': entry })).toEqual({
      version: 1,
      components: [
        {
          tag: 'lab-probe',
          subpath: 'probe',
          pascal: 'Probe',
          className,
          props: [
            { name: 'heading', attr: 'accessible-heading', kind: 'string' },
            { name: 'disabled', attr: 'disabled', kind: 'boolean' },
            { name: 'payload', attr: 'payload', kind: 'prop' },
          ],
          events: ['ancestor-change', 'value-change'],
          slots: { default: true, named: ['body', 'leading'], dynamic: false },
        },
      ],
    });
  });

  it.each([
    {
      name: 'конструктор не найден',
      entry: `
import { Absent } from './missing.js';
export { Absent };
customElements.define('lab-probe', Absent);
`,
    },
    { name: 'конструктор не передан', entry: "customElements.define('lab-probe');" },
    {
      name: 'конструктор не является классом',
      entry: "export const Other = {}; customElements.define('lab-probe', Other);",
    },
    {
      name: 'класс не экспортирован публично',
      entry: `
import { ActualElement } from './implementation.js';
customElements.define('lab-probe', ActualElement);
`,
    },
    {
      name: 'публичный экспорт доступен только как тип',
      entry: `
import { ActualElement } from './implementation.js';
export type { ActualElement } from './implementation.js';
customElements.define('lab-probe', ActualElement);
`,
    },
    {
      name: 'публичный экспорт доступен только как default',
      entry: `
import { ActualElement } from './implementation.js';
export default ActualElement;
customElements.define('lab-probe', ActualElement);
`,
    },
    {
      name: 'публичное имя неоднозначно',
      entry: `
import { ActualElement } from './implementation.js';
export { ActualElement as First, ActualElement as Second };
customElements.define('lab-probe', ActualElement);
`,
    },
  ])('$name: явная ошибка с тегом вместо пустых свойств', ({ entry }) => {
    expect(() => analyze({ ...implementation, 'probe/index.ts': entry })).toThrow(/lab-probe/);
  });

  it('одноимённые классы из разных модулей не смешивают свойства', () => {
    const result = analyze({
      'first/index.ts': `
import { Element as Registered } from './implementation.js';
export { Element as FirstElement } from './implementation.js';
customElements.define('lab-first', Registered);
`,
      'first/implementation.ts': `
export class Element extends HTMLElement {
  static properties = { first: { type: Boolean } };
}
`,
      'second/index.ts': `
import { Element as Registered } from './implementation.js';
export { Element as SecondElement } from './implementation.js';
customElements.define('lab-second', Registered);
`,
      'second/implementation.ts': `
export class Element extends HTMLElement {
  static properties = { second: { type: String } };
}
`,
    });
    expect(
      result.components.map(({ tag, className, props }) => ({ tag, className, props })),
    ).toEqual([
      {
        tag: 'lab-first',
        className: 'FirstElement',
        props: [{ name: 'first', attr: 'first', kind: 'boolean' }],
      },
      {
        tag: 'lab-second',
        className: 'SecondElement',
        props: [{ name: 'second', attr: 'second', kind: 'string' }],
      },
    ]);
  });
});
