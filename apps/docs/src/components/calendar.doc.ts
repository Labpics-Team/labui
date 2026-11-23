import '@labpics/ui-core/calendar';
import type { ComponentDoc } from '../template/component-doc.js';

function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const calendar = document.createElement('lab-calendar');
  calendar.defaultMonth = '2024-05-01';
  calendar.today = '2024-05-15';
  calendar.defaultValue =
    attrs.selection === 'range' ? ['2024-05-13', '2024-05-17'] : ['2024-05-15'];
  calendar.events = { '2024-05-15': 3, '2024-05-20': 5 };
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) calendar.setAttribute(key, value === true ? '' : value);
  return calendar;
}

export const calendarDoc: ComponentDoc = {
  slug: 'calendar',
  tag: 'lab-calendar',
  title: 'Calendar',
  summary:
    'Компактный календарь для одной даты или диапазона. Шесть недель, локализованные даты, события и клавиатурная навигация.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Размер',
        attribute: 'size',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
        ],
      },
      {
        name: 'Выбор',
        attribute: 'selection',
        options: [
          { label: 'Дата', value: 'single' },
          { label: 'Диапазон', value: 'range' },
        ],
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Месяц',
      description: 'В S подпись между стрелками; в M крупная подпись слева, обе стрелки справа.',
    },
    {
      index: 2,
      name: 'Gridcell',
      description:
        'Квадратная сетка 7 × 7: дни недели и шесть недель. Диапазон имеет общий фон и обозначенные края.',
    },
    {
      index: 3,
      name: 'Status Dots',
      description:
        'До пяти точек под датой. Доступное имя сообщает полное число событий; отдельный маркер означает отметку приложения.',
    },
  ],
  meaning: {
    purpose: 'Выбрать календарную дату без привязки ко времени суток или часовому поясу.',
    dos: [
      'Передавайте ISO-даты YYYY-MM-DD; range содержит 0, 1 или 2 даты.',
      'Обновляйте value и month после принятия соответствующего запроса.',
      'Задайте today одинаково на сервере и клиенте.',
      'Переведите подписи действий через translations; locale форматирует даты и дни недели.',
    ],
    donts: [
      'Не передавайте Date или timestamp вместо календарной даты.',
      'Не используйте mini-calendar как расписание с редактированием событий.',
    ],
  },
  liveExample: {
    make: () => {
      const section = document.createElement('section');
      const calendar = document.createElement('lab-calendar');
      calendar.locale = 'ru-RU';
      calendar.selection = 'range';
      calendar.label = 'Даты исследования';
      calendar.translations = {
        previousMonth: 'Предыдущий месяц',
        nextMonth: 'Следующий месяц',
        marker: 'Отмечено',
        events: 'Событий: {count}',
      };
      const output = document.createElement('p');
      output.textContent = 'Выберите начало и конец исследования.';
      calendar.addEventListener('value-change', (event) => {
        output.textContent = (event as CustomEvent<{ value: string[] }>).detail.value.join(' — ');
      });
      section.append(calendar, output);
      return section;
    },
    controls: [],
  },
  api: {
    props: [
      {
        name: 'size',
        type: "'s' | 'm'",
        default: "'s'",
        description: 'Авторские ширины 320/400; компонент сжимается до контейнера.',
      },
      {
        name: 'selection',
        type: "'single' | 'range'",
        default: "'single'",
        description: 'Одна дата либо включительный диапазон с промежуточным началом.',
      },
      {
        name: 'value / defaultValue',
        type: 'string[]',
        default: 'null / []',
        description:
          'Controlled-значение или начальный выбор. В React отсутствие value включает внутреннее состояние.',
      },
      {
        name: 'month / default-month',
        type: 'string',
        default: 'выбор или today',
        description: 'ISO-дата месяца. Нормализуется к первому дню.',
      },
      {
        name: 'locale / first-day-of-week',
        type: 'string / 0…6',
        default: 'en-US / locale',
        description:
          'Форматирование и начало недели. Календарная арифметика остаётся григорианской.',
      },
      {
        name: 'today',
        type: 'string',
        default: 'сегодня в UTC',
        description: 'aria-current=date; не выбирает дату автоматически.',
      },
      {
        name: 'min / max / isDateUnavailable',
        type: 'string / string / (date) => boolean',
        default: 'без ограничений',
        description: 'Границы и недоступные дни. Диапазон нельзя завершить через недоступный день.',
      },
      {
        name: 'unavailableDates',
        type: 'string[]',
        default: '[]',
        description:
          'Сериализуемые недоступные ISO-даты для SSR и гидрации. isDateUnavailable — дополнительная клиентская функция.',
      },
      {
        name: 'events / markers',
        type: 'Record<string, number | {count, label?}> / string[]',
        default: '{} / []',
        description:
          'Данные приложения для точек и круглых отметок; count сохраняется в доступном имени.',
      },
      {
        name: 'disabled / readonly / required',
        type: 'boolean',
        default: 'false',
        description:
          'Недоступность, чтение и обязательный полный выбор. React использует readOnly.',
      },
      {
        name: 'name',
        type: 'string',
        default: "''",
        description:
          'FormData.getAll(name) возвращает ISO-даты. Reset восстанавливает начальные значения.',
      },
      {
        name: 'translations / label',
        type: 'object / string',
        default: 'English labels',
        description:
          'Названия действий, событий, отметок и календаря. Для SSR events задаётся строкой с {count}; функция events доступна при клиентском рендере.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description: 'CustomEvent<{value: string[]}>. React: onValueChange(value).',
      },
      {
        name: 'month-change',
        description:
          'CustomEvent<{month: string}>. React: onMonthChange(month). Отказ сохраняет принятый месяц.',
      },
    ],
    slots: [],
  },
};
