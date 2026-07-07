/**
 * Фабрика тонких Vue-обёрток над Lit web-components (ADR-0001, A-prime).
 *
 * ЕДИНАЯ точка проброса для всех 27 компонентов: генерируемые файлы в
 * `src/generated/*` лишь передают сюда тег, спеки пропов и имена событий — сама
 * логика (атрибут vs свойство, булев флаг, слоты, форвардинг натива и событий)
 * живёт здесь один раз. Это «по образцу Button»: ту же семантику, что вручную
 * несла старая `button.ts`, теперь несёт фабрика для всего корпуса — чинит КЛАСС,
 * а не пишет 27 заплаток.
 *
 * Проброс пропов (обоснование `^`/`.` — из источника vuejs/core):
 *   - 'string'  → ключ `^attr`: Vue форсирует АТРИБУТ (иначе для upgraded-элемента
 *     сработало бы `key in el` и значение ушло бы свойством — незаметный дрейф
 *     между SSR и клиентом). Атрибут SSR-безопасен и до upgrade.
 *   - 'boolean' → `^attr` со значением `value || undefined`: голый `false` дал бы
 *     `attr="false"`, а Lit-конвертер читает присутствие атрибута как true;
 *     `undefined` убирает атрибут на любом пути.
 *   - 'prop'    → ключ `.name`: Vue форсирует JS-СВОЙСТВО. Единственный корректный
 *     путь для массивов/объектов (items, value-списки): атрибут из массива стал бы
 *     "[object Object]".
 * Дефолты осей НЕ дублируем — их несёт конструктор элемента (ноль дрейфа).
 *
 * Регистрация: генерируемый файл делает side-effect импорт
 * `@labpics/ui-core/<subpath>`, поэтому обёртка приносит элемент с собой.
 */
import { type DefineComponent, type VNode, defineComponent, h } from 'vue';

/** Способ проброса одного пропа — зеркалит PropKind манифеста. */
export type LabPropKind = 'boolean' | 'prop' | 'string';

/** Спека проброса одного пропа. */
export interface LabPropSpec {
  /** Имя свойства (camelCase). */
  readonly name: string;
  /** Имя атрибута на хосте (для 'string'/'boolean'). */
  readonly attr: string;
  /** Способ проброса. */
  readonly kind: LabPropKind;
}

/** Описание компонента для фабрики. */
export interface LabComponentSpec {
  /** Имена всех пропов — объявляются Vue как props (а не fallthrough-attrs). */
  readonly props: readonly string[];
  /** Спеки проброса, по одной на проп. */
  readonly specs: readonly LabPropSpec[];
  /** Имена кастом-событий (kebab) — для типизации обработчиков. */
  readonly events: readonly string[];
}

/** kebab → PascalCase на уровне типов: 'value-change' → 'ValueChange'. */
type Pascalize<S extends string> = S extends `${infer H}-${infer T}`
  ? `${Capitalize<H>}${Pascalize<T>}`
  : Capitalize<S>;

/** Отображение имён событий в типизированные обработчики `onXxx`. */
export type LabEventHandlers<E extends string> = {
  [K in E as `on${Pascalize<K>}`]?: (event: CustomEvent) => void;
};

/**
 * Публичный тип обёртки: частичные пропы (дефолты у элемента) + типизированные
 * обработчики событий. Нативные атрибуты (aria-label, id, class, data-*) проходят
 * штатным fallthrough Vue.
 */
export type LabComponent<Props, Events extends string> = DefineComponent<
  Partial<Props> & LabEventHandlers<Events>
>;

/**
 * Создаёт Vue-компонент, монтирующий кастом-элемент `tag` и пробрасывающий на него
 * объявленные пропы, слоты и нативные атрибуты/события.
 */
export function createLabComponent<Props, Events extends string>(
  tag: string,
  spec: LabComponentSpec,
): LabComponent<Props, Events> {
  const component = defineComponent({
    name: `Lab_${tag}`,
    // Натив (aria-label, id, class, data-*, слушатели событий) пробрасываем вручную
    // ниже — отключаем авто-наследование, чтобы не применить дважды.
    inheritAttrs: false,
    props: spec.props as unknown as string[],
    setup(props: Record<string, unknown>, { slots, attrs }) {
      return () => {
        // Натив и слушатели событий (onValueChange → 'value-change') — сначала,
        // объявленные пропы форсируем ниже своими ключами (пересечений нет: Vue
        // изымает объявленные пропы из attrs).
        const bindings: Record<string, unknown> = { ...attrs };
        for (const s of spec.specs) {
          const value = props[s.name];
          if (s.kind === 'prop') {
            if (value !== undefined) bindings[`.${s.name}`] = value;
          } else if (s.kind === 'boolean') {
            bindings[`^${s.attr}`] = value || undefined;
          } else {
            bindings[`^${s.attr}`] = value;
          }
        }
        // Слоты: default → дети; именованные (в т.ч. динамические content/icon/…)
        // оборачиваем в display:contents-элемент с slot=<name> (нативное слотирование
        // требует РЕНДЕРЯЩИЙСЯ узел в light-DOM; <template> не спроецировался бы).
        const children: unknown[] = [];
        for (const [name, slotFn] of Object.entries(slots)) {
          if (!slotFn) continue;
          if (name === 'default') children.push(slotFn());
          else children.push(h('div', { slot: name, style: 'display:contents' }, slotFn()));
        }
        return h(tag, bindings, children as VNode[]);
      };
    },
  });
  return component as unknown as LabComponent<Props, Events>;
}
