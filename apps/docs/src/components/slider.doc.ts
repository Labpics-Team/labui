import '@labpics/ui-core/slider';
import type { ComponentDoc } from '../template/component-doc.js';
function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-slider');
  element.label = 'Насыщенность';
  element.defaultValue = [40];
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  return element;
}
const variants = ['linear', 'circular', 'large'].map((value) => ({ label: value, value }));
export const sliderDoc: ComponentDoc = {
  slug: 'slider',
  order: 9,
  tag: 'lab-slider',
  title: 'Slider',
  summary:
    'Точное значение или диапазон. Линейная, круговая и большая шкалы сохраняют авторские дорожки, бегунки и окраску подписи.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Представление', attribute: 'variant', options: variants },
      {
        name: 'Состояние',
        attribute: 'disabled',
        options: [
          { label: 'Обычное', value: false },
          { label: 'Недоступное', value: true },
        ],
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Шкала',
      description:
        'Linear: дорожка 4 px, бегунок 12 px с внутренней обводкой 3 px. Circular: диаметр 96 px, начало сверху, рост по часовой стрелке.',
    },
    {
      index: 2,
      name: 'Большая шкала',
      description:
        'Высота 56 px, радиус 16 px, контрастная подпись и индикатор 3 × 16 px. Подпись меняет цвет точно на границе заполнения.',
    },
    {
      index: 3,
      name: 'Значение',
      description:
        'Один бегунок выбирает число. Два бегунка задают упорядоченный диапазон и сохраняют порядок при работе клавиатурой.',
    },
  ],
  meaning: {
    purpose: 'Позволить человеку непосредственно настроить числовое значение.',
    dos: [
      'Задайте понятное название и действительные границы.',
      'Для точного ввода рядом можно показать Number Input.',
      'У диапазона используйте понятные имена нижней и верхней границы.',
    ],
    donts: [
      'Не используйте шкалу для неизвестного хода работы: это Progress.',
      'Не превращайте круговую шкалу в бесконечно вращающийся регулятор.',
    ],
  },
  liveExample: {
    make: () => make({ 'show-value': true }),
    controls: [
      { kind: 'select', label: 'Представление', attribute: 'variant', options: variants },
      { kind: 'toggle', label: 'Значение', attribute: 'show-value' },
      { kind: 'toggle', label: 'Только чтение', attribute: 'readonly' },
    ],
  },
  api: {
    props: [
      {
        name: 'variant',
        type: "'linear' | 'circular' | 'large'",
        default: "'linear'",
        description: 'Авторское представление. Large принимает одно значение.',
      },
      {
        name: 'value',
        type: 'number[] | null',
        default: 'null',
        description:
          'Заданное значение управляется приложением, включая JS property. null возвращает внутреннее состояние.',
      },
      {
        name: 'default-value',
        type: 'number[]',
        default: '[50]',
        description:
          'Начальное внутреннее значение и цель сброса формы. Один элемент — число, два — упорядоченный диапазон.',
      },
      {
        name: 'min / max / step',
        type: 'number',
        default: '0 / 100 / 1',
        description:
          'Конечные возрастающие границы и положительный шаг. Шаг отсчитывается от min; диапазон не пересекается.',
      },
      {
        name: 'label / thumb-labels',
        type: 'string / string[]',
        description: 'Название контроля и необязательные отдельные имена двух бегунков.',
      },
      {
        name: 'label-hidden / show-value',
        type: 'boolean',
        default: 'false',
        description:
          'Скрыть внешнюю подпись или показать текущее значение. Доступное имя сохраняется.',
      },
      {
        name: 'name / form',
        type: 'string',
        description: 'Имя поля и внешняя форма. Диапазон передаёт два значения с одним именем.',
      },
      {
        name: 'orientation',
        type: "'horizontal' | 'vertical'",
        default: "'horizontal'",
        description: 'Вертикальная ориентация доступна линейной шкале.',
      },
      {
        name: 'readonly / disabled / invalid',
        type: 'boolean',
        default: 'false',
        description: 'Чтение без изменений, недоступный контроль или ошибка в значении.',
      },
      {
        name: 'helper / error',
        type: 'string',
        description: 'Пояснение и текст ошибки, связанные с каждым бегунком.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<{ value: number[] }> — новое значение при вводе; Escape и pointercancel возвращают исходное.',
      },
      {
        name: 'value-change-end',
        description:
          'Подтверждённое изменённое значение после отпускания указателя или клавиатурного ввода.',
      },
    ],
    slots: [],
  },
};
