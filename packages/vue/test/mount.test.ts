/**
 * Клиентский маунт-смоук (happy-dom, задаётся vitest.config): обёртка монтирует реальный
 * <lab-*>, пробрасывает пропы атрибутами/свойствами, слоты и кастом-события. 3
 * репрезентативных компонента: button (слоты + булевы), input (свойство value),
 * checkbox (кастом-событие).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { Badge } from '../src/generated/badge.js';
import { Button } from '../src/generated/button.js';
import { Checkbox } from '../src/generated/checkbox.js';
import { Input } from '../src/generated/input.js';
import { Switch } from '../src/generated/switch.js';

// happy-dom не вычисляет относительный CSS transform. Здесь проверяем Boolean,
// слоты и события; реальный Motion проверяется в браузерных consumer fixtures.
vi.mock('../../core/node_modules/@labpics/motion', () => ({
  scope: () => ({ animate: vi.fn(), on: vi.fn(), dispose: vi.fn() }),
}));

type CheckedElement = HTMLElement & {
  checked: boolean;
  indeterminate?: boolean;
  updateComplete: Promise<boolean>;
};

async function expectState(element: Element | null, checked: boolean, mixed = false) {
  const el = element as CheckedElement;
  await nextTick();
  await el.updateComplete;
  const input = el.shadowRoot?.querySelector('input');
  expect({
    checked: el.checked,
    mixed: el.indeterminate ?? false,
    native: input?.checked,
    nativeMixed: input?.indeterminate,
  }).toEqual({ checked, mixed, native: checked, nativeMixed: mixed });
}

function mount(node: ReturnType<typeof h>): { host: HTMLElement; unmount: () => void } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = createApp({ render: () => node });
  app.mount(host);
  return { host, unmount: () => app.unmount() };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Vue mount (проброс на <lab-*>)', () => {
  it('Badge сохраняет содержимое, события и размерную коробку именованного слота', () => {
    const clicked = vi.fn();
    const { host, unmount } = mount(
      h(
        Badge,
        {},
        {
          default: () => 'Статус',
          leading: () =>
            h('svg', { width: 24, height: 24, onClick: clicked }, [
              h('path', { d: 'M0 0h24v24H0Z' }),
            ]),
        },
      ),
    );
    const wrapper = host.querySelector<HTMLElement>('[slot="leading"]');
    expect(wrapper?.hasAttribute('data-lab-slot-fill')).toBe(true);
    expect(wrapper?.style.display).toBe('inline-flex');
    expect(wrapper?.querySelector('svg')?.getAttribute('width')).toBe('24');
    wrapper?.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toHaveBeenCalledOnce();
    const directText = [...(host.querySelector('lab-badge')?.childNodes ?? [])]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('');
    expect(directText).toBe('Статус');
    unmount();
    expect(host.childNodes.length).toBe(0);
  });
  it('boolean: пропущенный checked использует default, явный false сохраняется', async () => {
    const { host, unmount } = mount(
      h('div', [
        h(Switch, { defaultChecked: true }),
        h(Switch, { checked: false, defaultChecked: true }),
      ]),
    );
    try {
      const controls = host.querySelectorAll('lab-switch');
      await expectState(controls[0], true);
      await expectState(controls[1], false);
    } finally {
      unmount();
    }
  });

  it('boolean: пропущенный mixed использует default, явный false сохраняется', async () => {
    const { host, unmount } = mount(
      h('div', [
        h(Checkbox, { defaultIndeterminate: true }),
        h(Checkbox, { indeterminate: false, defaultIndeterminate: true }),
      ]),
    );
    try {
      const controls = host.querySelectorAll('lab-checkbox');
      await expectState(controls[0], false, true);
      await expectState(controls[1], false);
    } finally {
      unmount();
    }
  });

  it('boolean: undefined и посторонний render сохраняют текущее пользовательское состояние', async () => {
    const checked = ref<boolean | undefined>(false);
    const size = ref<'s' | 'm' | 'l'>('m');
    const target = document.createElement('div');
    document.body.append(target);
    const events: boolean[] = [];
    const app = createApp({
      render: () =>
        h(Switch, {
          checked: checked.value,
          defaultChecked: true,
          size: size.value,
          onCheckedChange: (event: CustomEvent<{ checked: boolean }>) =>
            events.push(event.detail.checked),
        }),
    });
    app.mount(target);
    const el = target.querySelector('lab-switch') as CheckedElement;
    try {
      await expectState(el, false);
      checked.value = true;
      await expectState(el, true);
      checked.value = undefined;
      await expectState(el, true);
      el.shadowRoot?.querySelector('input')?.click();
      await expectState(el, false);
      size.value = 's';
      await expectState(el, false);
      el.shadowRoot?.querySelector('input')?.click();
      await expectState(el, true);
      size.value = 'l';
      await expectState(el, true);
      expect(events).toEqual([false, true]);
    } finally {
      app.unmount();
    }
  });

  it('button: строковые оси → атрибуты, false-булев снят, слот в light DOM', async () => {
    const { host } = mount(
      h(Button, { type: 'accent', size: 'l', disabled: false, loading: true }, () => 'Сохранить'),
    );
    const el = host.querySelector('lab-button');
    expect(el).toBeTruthy();
    const button = el as HTMLElement & { loading: boolean; updateComplete: Promise<boolean> };
    expect(button.loading).toBe(true);
    await button.updateComplete;
    expect(el?.getAttribute('type')).toBe('accent');
    expect(el?.getAttribute('size')).toBe('l');
    // disabled=false → атрибут снят (иначе Lit прочитал бы присутствие как true).
    expect(el?.hasAttribute('disabled')).toBe(false);
    // loading=true → атрибут-флаг присутствует.
    expect(el?.hasAttribute('loading')).toBe(true);
    expect(el?.textContent).toContain('Сохранить');
  });

  it('button: html-type маппится на атрибут html-type (camelCase проп)', () => {
    const { host } = mount(h(Button, { htmlType: 'submit' }, () => 'OK'));
    const el = host.querySelector('lab-button');
    expect(el?.getAttribute('html-type')).toBe('submit');
  });

  it('input: value доходит как атрибут, label — тоже', () => {
    const { host } = mount(h(Input, { label: 'Имя', value: 'Даниил' }));
    const el = host.querySelector('lab-input');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('label')).toBe('Имя');
    expect(el?.getAttribute('value')).toBe('Даниил');
  });

  it('checkbox: кастом-событие checked-change доходит до обработчика', () => {
    const onCheckedChange = vi.fn();
    const { host } = mount(h(Checkbox, { onCheckedChange }));
    const el = host.querySelector('lab-checkbox');
    expect(el).toBeTruthy();
    el?.dispatchEvent(new CustomEvent('checked-change', { detail: { checked: true } }));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
  });
});
