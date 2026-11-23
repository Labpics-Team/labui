import '@labpics/ui-core/color-picker';
import type { ComponentDoc } from '../template/component-doc.js';
const models = ['hex', 'hsb', 'hsl', 'rgb', 'lch'].map((value) => ({
  label: value.toUpperCase(),
  value,
}));
const variants = ['grid', 'spectrum', 'sliders'].map((value) => ({ label: value, value }));
function make(attrs: Readonly<Record<string, string | boolean>>) {
  const element = document.createElement('lab-color-picker');
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  return element;
}
export const colorPickerDoc: ComponentDoc = {
  slug: 'color-picker',
  tag: 'lab-color-picker',
  title: 'ColorPicker',
  summary:
    'Палитра, спектр и точные каналы одного цвета. HEX, RGB, HSB, HSL и CIELCH D50 сохраняют исходную точность.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Представление', attribute: 'variant', options: variants },
      { name: 'Модель', attribute: 'model', options: models },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Представление',
      description:
        'Grid содержит 120 авторских образцов в сетке 12×10, а LCH — 100 в сетке 10×10. Spectrum изменяет две координаты. Sliders предоставляет отдельные каналы; HEX принимает шестнадцатеричные байты.',
    },
    {
      index: 2,
      name: 'Каналы и прозрачность',
      description:
        'Стрелки изменяют значение шкалы; текст принимает точное число. Enter подтверждает ввод, Escape отменяет черновик или жест.',
    },
    {
      index: 3,
      name: 'CIELCH D50',
      description:
        'Графики и дорожки показывают реальные сечения sRGB, Display P3 и Rec.2020. Шахматное поле означает выход за выбранный gamut.',
    },
  ],
  meaning: {
    purpose: 'Выбирать и уточнять цвет, сохраняя единое значение при смене представления.',
    dos: [
      'Передавайте структурное значение: space, coords и alpha.',
      'Используйте defaultModel/defaultVariant для начального вида и model/variant для управляемого.',
      'Подключайте pickScreenColor только к настоящему отбору пикселя.',
    ],
    donts: [
      'Не считайте HEX точным хранилищем широкого gamut.',
      'Не преобразуйте принятое значение при открытии другой модели.',
    ],
  },
  liveExample: {
    make: () => make({}),
    controls: [
      { kind: 'toggle', label: 'Только чтение', attribute: 'readonly' },
      { kind: 'toggle', label: 'Недоступно', attribute: 'disabled' },
    ],
  },
  api: {
    props: [
      {
        name: 'value / defaultValue',
        type: 'LabColorValue | null',
        description:
          'Три координаты Number и alpha0..1. value undefined включает внутреннее состояние; null означает пустой выбор.',
      },
      {
        name: 'model / defaultModel',
        type: "'hex' | 'hsb' | 'hsl' | 'rgb' | 'lch'",
        default: "'hex'",
        description: 'Проекция текста; смена не вызывает value-change.',
      },
      {
        name: 'variant / defaultVariant',
        type: "'grid' | 'spectrum' | 'sliders'",
        default: "'spectrum'",
        description: 'Представление выбирается независимо от значения.',
      },
      {
        name: 'name / form / required',
        type: 'string / string / boolean',
        description: 'Форма получает точный JSON; reset восстанавливает исходный defaultValue.',
      },
      {
        name: 'readonly / disabled',
        type: 'boolean',
        default: 'false',
        description: 'Запрет редактирования или недоступное поле.',
      },
      {
        name: 'pickScreenColor',
        type: '() => Promise<LabColorValue | null>',
        description:
          'Необязательный адаптер пипетки. В браузере применяется официальный EyeDropper; без возможности кнопка недоступна.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'Запрос нового структурного значения; управляемый потребитель принимает его обновлением value.',
      },
      {
        name: 'value-change-end',
        description:
          'Только фактически принятое изменённое значение после завершения редактирования.',
      },
      {
        name: 'model-change / variant-change',
        description: 'Запрос изменения управляемого представления.',
      },
      { name: 'close-request', description: 'Запрос закрыть содержащую панель или диалог.' },
    ],
    slots: [],
  },
};
