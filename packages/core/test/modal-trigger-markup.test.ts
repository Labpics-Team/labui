import { describe, expect, it } from 'vitest';
import { assertModalTriggerMarkup } from '../src/components/dialog/ssr.js';
import { projectSingleSlot } from '../src/ssr/slot-projection.js';

const modalMarkup = (tag: string, children: string): string => `<${tag}>
  <template shadowrootmode="open"><slot name="trigger" data-projection="direct">
    <button class="trigger" type="button"><slot></slot></button>
  </slot></template>${children}</${tag}>`;

describe('direct slot HTML projection', () => {
  it('отсутствующий named slot сохраняет прежнюю подпись', () => {
    expect(projectSingleSlot(undefined, 'trigger')).toBe('');
  });

  it('сохраняет исходные кавычки, entities, DSD и hydration markers', () => {
    const markup = `<!--lit-part a--><lab-button kind='border'><template shadowrootmode="open"><button type="button">Настроить</button></template>Цвет &amp; тема</lab-button><!--/lit-part-->`;
    expect(projectSingleSlot(markup, 'trigger')).toBe(
      markup.replace("kind='border'>", 'kind=\'border\' slot="trigger">'),
    );
  });

  it('назначает slot настоящей native button и сохраняет уже назначенный', () => {
    expect(projectSingleSlot('<button type="button">Открыть</button>', 'trigger')).toBe(
      '<button type="button" slot="trigger">Открыть</button>',
    );
    const assigned = '<lab-button slot="trigger">Открыть</lab-button>';
    expect(projectSingleSlot(assigned, 'trigger')).toBe(assigned);
  });

  it.each([
    '',
    'Текст',
    '<button type="button">Один</button><button type="button">Два</button>',
    'Подпись<button type="button">Открыть</button>',
    '<button type="button" slot="content">Открыть</button>',
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  ])('не скрывает неверный direct slot: %s', (markup) => {
    expect(() => projectSingleSlot(markup, 'trigger')).toThrow(TypeError);
  });
});

describe('Modal SSR принимает тот же единственный opener, что Core', () => {
  it.each([
    '<lab-button slot="trigger"><input /></lab-button>',
    '<lab-button slot="trigger"><a href="/">Открыть</a></lab-button>',
    '<lab-button slot="trigger"><input slot="icon" /></lab-button>',
    '<lab-button slot="trigger"><button slot="end" type="button">Ещё</button></lab-button>',
    '<lab-button slot="trigger"><span role="combobox">Открыть</span></lab-button>',
  ])('один opener отвергает вложенный control в LabButton: %s', (children) => {
    expect(() => assertModalTriggerMarkup(modalMarkup('lab-sheet', children))).toThrow(TypeError);
  });

  it('один opener сохраняет rich label и неинтерактивные icon/end slots', () => {
    for (const children of [
      '<lab-button slot="trigger"><svg slot="icon" aria-hidden="true"><path d="M0 0h1" /></svg><span>Настроить <strong>цвет</strong></span><svg slot="end" aria-hidden="true"><path d="M0 0h1" /></svg></lab-button>',
      '<button slot="trigger" type="button"><svg aria-hidden="true"><path d="M0 0h1" /></svg><span>Настроить <strong>цвет</strong></span></button>',
    ]) {
      expect(() => assertModalTriggerMarkup(modalMarkup('lab-sheet', children))).not.toThrow();
    }
  });

  it('собственный DSD LabButton не превращается во второй opener', () => {
    const children = `<lab-button slot="trigger"><template shadowrootmode="open"><button type="button"><slot name="icon"></slot><slot></slot><slot name="end"></slot></button></template><svg slot="icon" role="img"><title>Цвет</title></svg><span contenteditable="FALSE">Настроить</span></lab-button>`;
    expect(() => assertModalTriggerMarkup(modalMarkup('lab-sheet', children))).not.toThrow();
  });

  it.each([
    '<span role="unsupported combobox">Поиск</span>',
    '<span role="slider">Значение</span>',
    '<label for="outside">Поле</label>',
    '<details><summary>Параметры</summary></details>',
    '<svg><a xlink:href="/">Открыть</a></svg>',
    '<img usemap="#outside" alt="Карта" />',
  ])('одинаково отвергает вложенные controls в обоих opener: %s', (label) => {
    for (const trigger of [
      `<lab-button slot="trigger">${label}</lab-button>`,
      `<button slot="trigger" type="button">${label}</button>`,
    ]) {
      expect(() => assertModalTriggerMarkup(modalMarkup('lab-sheet', trigger))).toThrow(TypeError);
    }
  });

  it.each(['lab-sheet', 'lab-dialog', 'lab-alert-dialog'])(
    '%s: сохраняет оба допустимых входа',
    (tag) => {
      for (const children of [
        'Открыть <span>настройки</span><div slot="content"><input value="Ввод" /></div>',
        '<button slot="trigger" type="button">Открыть</button>',
        '<lab-button slot="trigger" type="neutral" kind="ghost">Открыть</lab-button>',
      ]) {
        expect(() => assertModalTriggerMarkup(modalMarkup(tag, children))).not.toThrow();
      }
    },
  );

  it.each([
    '<span slot="trigger"><lab-button>Открыть</lab-button></span>',
    '<button slot="trigger" type="button">Один</button><button slot="trigger" type="button">Два</button>',
    '<input slot="trigger" />',
    '<custom-trigger slot="trigger">Открыть</custom-trigger>',
    '<button slot="trigger" type="submit">Открыть</button>',
    '<button slot="trigger">Открыть</button>',
    '<lab-button slot="trigger" html-type="reset">Открыть</lab-button>',
    '<button slot="trigger" type="button"><input /></button>',
    '<lab-button>Открыть</lab-button>',
    '<lab-button slot="trigger">Открыть</lab-button><button type="button">Вторая кнопка</button>',
    '<span><button type="button">Открыть</button></span>',
    '<a href="/">Открыть</a>',
    '<span contenteditable>Открыть</span>',
    '<svg tabindex="0"><title>Открыть</title></svg>',
  ])('отвергает wrapper, второй control и interactive подпись: %s', (children) => {
    expect(() => assertModalTriggerMarkup(modalMarkup('lab-sheet', children))).toThrow(TypeError);
  });

  it('не применяет Core contract к чужому custom host без Core DSD', () => {
    expect(() =>
      assertModalTriggerMarkup('<lab-sheet><custom-trigger /></lab-sheet>'),
    ).not.toThrow();
  });
});
