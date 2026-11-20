import '@labpics/ui-core/menu';
import '@labpics/ui-core/context-menu';
import '@labpics/ui-core/menubar';
import { symbol as checkmark } from '@labpics/icons/symbols/checkmark';
import type { LabMenuItem } from '@labpics/ui-core/menu';
import type { ComponentDoc } from '../template/component-doc.js';

const items: readonly LabMenuItem[] = [
  { value: 'open', label: 'Открыть', icon: checkmark, type: 'accent', shortcut: ['⌘', 'O'] },
  { value: 'offline', label: 'Доступно офлайн', kind: 'check', closeOnSelect: false },
  { value: 'separator', kind: 'separator' },
  {
    value: 'export',
    label: 'Экспорт',
    kind: 'submenu',
    items: [
      { value: 'pdf', label: 'PDF' },
      { value: 'png', label: 'PNG' },
    ],
  },
  { value: 'archive', label: 'Архивировать', disabled: true },
  { value: 'delete', label: 'Удалить', type: 'danger' },
];
export function menuFamilyDoc(
  tag: 'lab-menu' | 'lab-context-menu' | 'lab-menubar',
): Omit<ComponentDoc, 'slug' | 'title' | 'order'> {
  const make = (attrs: Readonly<Record<string, string | boolean>> = {}) => {
    const node = document.createElement(tag);
    node.label = 'Действия';
    if ('items' in node) node.items = items;
    if ('menus' in node)
      node.menus = [
        { value: 'file', label: 'Файл', items },
        {
          value: 'view',
          label: 'Вид',
          items: [
            { value: 'zoom', label: 'Увеличить' },
            { value: 'fit', label: 'По размеру окна' },
          ],
        },
      ];
    if (tag === 'lab-context-menu') {
      node.textContent = 'Правый клик или Shift+F10';
      node.style.padding = '1rem';
    }
    for (const [key, value] of Object.entries(attrs))
      if (value !== false) node.setAttribute(key, value === true ? '' : String(value));
    return node;
  };
  return {
    tag,
    summary:
      'Связанные команды с вложенными меню, переключателями и радиогруппами. Общий контракт данных, клавиатурная навигация и локальная тема во всех исполнениях.',
    status: { kind: 'stable' },
    statesMatrix: {
      axes: [
        {
          name: 'Доступность',
          attribute: 'disabled',
          options: [
            { label: 'Доступно', value: false },
            { label: 'Недоступно', value: true },
          ],
        },
      ],
      make,
    },
    anatomy: [
      {
        index: 1,
        name: 'Управление',
        description:
          'Кнопка, область контекстных действий или горизонтальный ряд команд. Menubar перемещает фокус стрелками с учётом RTL.',
      },
      {
        index: 2,
        name: 'Панель',
        description:
          'Ширина 256, радиус 12, отступ 4. Материал Elevated со Strong blur в Acrylic-сцене; тень M для dropdown и XS для context/menubar. Панель сохраняет тему и контекст диалога.',
      },
      {
        index: 3,
        name: 'Строка',
        description:
          'Geist Body 16/24, отступы 12×8, радиус 8, иконка 16. Нейтральный, акцентный или опасный тон. Недоступная строка сохраняет геометрию и скрывает правые аксессуары.',
      },
      {
        index: 4,
        name: 'Выбор',
        description:
          'Галочка и точка показывают checkedValues. Радиогруппа допускает одно выбранное значение; нажатие уже выбранного radio его не снимает.',
      },
    ],
    meaning: {
      purpose:
        'Команды над документом, объектом или текущим представлением. Контекстное меню вызывается правым кликом, долгим нажатием, клавишей ContextMenu или Shift+F10.',
      dos: [
        'Сохраняйте уникальные value во всём дереве.',
        'Передавайте импортированные Icons symbols и массив клавиш shortcut.',
        'Для контролируемого состояния передавайте open/value и checkedValues; обрабатывайте события изменения.',
        'Объединяйте связанные radio общим group.',
      ],
      donts: [
        'Не меняйте value при переименовании или перестановке строки.',
        'Не переносите панели вручную в body.',
        'Не используйте подпись shortcut как обработчик глобальной клавиши: приложение выполняет команду отдельно.',
      ],
    },
    liveExample: {
      make: () => make(),
      controls: [{ kind: 'toggle', label: 'Недоступно', attribute: 'disabled' }],
    },
    api: {
      props: [
        {
          name: 'items',
          type: 'readonly LabMenuItem[]',
          default: '[]',
          description:
            'Дерево action, check, radio, submenu, separator. Каждый value уникален во всём дереве.',
        },
        {
          name: 'menus',
          type: 'readonly LabMenubarItem[]',
          default: '[]',
          description: 'Корневые записи Menubar: value, label, disabled?, heading?, items.',
        },
        {
          name: 'open / defaultOpen',
          type: 'boolean / boolean',
          default: 'undefined / false',
          description:
            'Контролируемое или начальное открытие Menu и ContextMenu. Undefined передаёт управление компоненту.',
        },
        {
          name: 'value / defaultValue',
          type: 'string | null',
          default: 'undefined / null',
          description:
            'Открытая запись Menubar. Null закрывает все панели; undefined включает внутреннее состояние.',
        },
        {
          name: 'checkedValues / defaultCheckedValues',
          type: 'readonly string[]',
          default: 'undefined / []',
          description:
            'Выбранные check/radio. Устаревшие значения исключаются, в каждой radio-группе остаётся одно.',
        },
        {
          name: 'placement',
          type: "'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'",
          default: "'bottom-start'",
          description:
            'Предпочтительное положение. У края экрана панель автоматически переносится.',
        },
        {
          name: tag === 'lab-menubar' ? 'label' : 'label / heading',
          type: 'string',
          default: "'Menu' / ''",
          description:
            tag === 'lab-menubar'
              ? 'Имя управления; heading задаётся у каждой записи menus.'
              : 'Имя управления и необязательный заголовок панели.',
        },
        {
          name: 'disabled',
          type: 'boolean',
          default: 'false',
          description: 'Отключает открытие и закрывает открытую панель.',
        },
      ].filter(({ name }) =>
        tag === 'lab-menubar'
          ? name !== 'items' && name !== 'open / defaultOpen'
          : name !== 'menus' && name !== 'value / defaultValue',
      ),
      events: [
        { name: 'select', description: 'detail: { value } — выполненная команда.' },
        {
          name: 'open-change',
          description: 'detail: { open } — запрос открытия Menu/ContextMenu.',
        },
        {
          name: 'value-change',
          description: 'detail: { value } — запрос открытой записи Menubar.',
        },
        {
          name: 'checked-values-change',
          description: 'detail: { values } — следующий набор выбранных значений.',
        },
      ].filter(({ name }) => name !== (tag === 'lab-menubar' ? 'open-change' : 'value-change')),
      slots:
        tag === 'lab-context-menu'
          ? [{ name: 'default', description: 'Область, к которой относятся контекстные действия.' }]
          : [],
    },
  };
}
