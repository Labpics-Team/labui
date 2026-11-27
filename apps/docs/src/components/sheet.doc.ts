import '@labpics/ui-core/button';
import '@labpics/ui-core/input';
import type { LabSheetPosition } from '@labpics/ui-core/sheet';
import '@labpics/ui-core/sheet';
import type { ComponentDoc } from '../template/component-doc.js';

const positionLabels: Record<LabSheetPosition, string> = {
  full: 'Full',
  'two-thirds': 'Two thirds',
  half: 'Half',
  'one-third': 'One third',
  flex: 'Flex — по содержимому',
};
const positions = Object.entries(positionLabels).map(([value, label]) => ({ value, label }));

function makeSheet(
  attrs: Readonly<Record<string, string | boolean>>,
  triggerLabel = 'Настроить проект',
): HTMLElement {
  const sheet = document.createElement('lab-sheet');
  sheet.heading = 'Название проекта';
  sheet.description = 'Изменения сохраняются в этом примере.';
  sheet.closable = true;
  const trigger = document.createElement('lab-button');
  trigger.slot = 'trigger';
  trigger.textContent = triggerLabel;
  const content = document.createElement('div');
  content.slot = 'content';
  content.style.cssText = 'display:grid;gap:24px';
  const input = document.createElement('lab-input');
  input.setAttribute('label', 'Название');
  input.value = 'Мой проект';
  const save = document.createElement('lab-button');
  save.textContent = 'Сохранить';
  save.addEventListener('click', () => {
    trigger.textContent = input.value.trim() || 'Настроить проект';
    sheet.open = false;
  });
  content.append(input, save);
  sheet.append(trigger, content);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false) sheet.setAttribute(key, value === true ? '' : value);
  }
  return sheet;
}

export const sheetDoc: ComponentDoc = {
  slug: 'sheet',
  tag: 'lab-sheet',
  title: 'Sheet',
  summary:
    'Нижняя панель для короткой задачи. Высоту можно выбрать заранее или подстроить под содержимое.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [{ name: 'Положение', attribute: 'position', options: positions }],
    make: (attrs) => makeSheet(attrs, 'Открыть'),
  },
  anatomy: [
    {
      index: 1,
      name: 'Поверхность',
      description: 'Материал панели с верхним радиусом 32 px и внутренними отступами 16 px.',
    },
    {
      index: 2,
      name: 'Ручка',
      description: 'Перемещает панель между положениями. Доступна перетаскиванием и с клавиатуры.',
    },
    {
      index: 3,
      name: 'Заголовок',
      description: 'Называет задачу; описание уточняет её. Оба входят в естественную высоту Flex.',
    },
    {
      index: 4,
      name: 'Содержимое',
      description: 'Форма или другие компоненты. Длинное содержимое прокручивается внутри панели.',
    },
  ],
  meaning: {
    purpose:
      'Sheet сохраняет контекст страницы и даёт место одной задаче: настройке, фильтру или небольшому редактированию.',
    dos: [
      'Называйте задачу в heading.',
      'Используйте Flex для короткого содержимого.',
      'Сохраняйте введённые данные при изменении высоты.',
    ],
    donts: [
      'Не прячьте основное действие за перетаскиванием.',
      'Не открывайте вложенные панели для обычного перехода между разделами.',
    ],
  },
  liveExample: {
    make: () => makeSheet({ position: 'flex' }),
    controls: [{ kind: 'select', label: 'Положение', attribute: 'position', options: positions }],
  },
  api: {
    props: [
      {
        name: 'open',
        type: 'boolean',
        default: 'false',
        description: 'Открывает панель; закрытие возвращает фокус к вызвавшему элементу.',
      },
      {
        name: 'position',
        type: Object.keys(positionLabels)
          .map((value) => `'${value}'`)
          .join(' | '),
        default: "'half'",
        description:
          'Положение из макета. Flex измеряет содержимое; все положения ограничены доступной высотой окна.',
      },
      {
        name: 'heading',
        type: 'string',
        default: "''",
        description: 'Заголовок и доступное имя панели.',
      },
      {
        name: 'description',
        type: 'string',
        default: "''",
        description: 'Пояснение под заголовком.',
      },
      {
        name: 'modal',
        type: 'boolean',
        default: 'true',
        description:
          'Удерживает фокус внутри и блокирует страницу за панелью. В HTML отключается через modal="false".',
      },
      {
        name: 'closable',
        type: 'boolean',
        default: 'false',
        description: 'Показывает отдельную кнопку закрытия.',
      },
      {
        name: 'aria-label',
        type: 'string',
        description: 'Доступное имя, если видимого заголовка нет.',
      },
    ],
    events: [
      {
        name: 'open-change',
        description: 'CustomEvent<{ open: boolean }> при открытии или закрытии пользователем.',
      },
      {
        name: 'position-change',
        description: 'CustomEvent<{ position: LabSheetPosition }> при выборе высоты ручкой.',
      },
      {
        name: 'motion-error',
        description: 'CustomEvent<{ error: unknown }> при ошибке движения; панель закрывается.',
      },
    ],
    slots: [
      { name: 'trigger', description: 'Готовая кнопка type="button", например lab-button.' },
      {
        name: '(default)',
        description: 'Подпись встроенной кнопки открытия, если trigger не задан.',
      },
      { name: 'content', description: 'Содержимое панели; сохраняется при закрытии.' },
    ],
  },
};
