import {
  LAB_INPUTS_PROPERTY,
  type LabPropSpec,
  slotProjectionShadow,
} from '@labpics/ui-core/adapter-runtime';
/**
 * Фабрика тонких Vue-обёрток над Lit web-components (ADR-0001, A-prime).
 *
 * Генератор передаёт тег, спеки и события. SSR добавляет только shadow root;
 * host, слоты и нативные события остаются узлами Vue. Общий forwardDeclared
 * применяет входы через DOM property до connection и при реактивных изменениях.
 * Он не повторяет начальную SSR-запись поверх восстановленного ввода пользователя.
 *
 * Регистрация: генерируемый файл делает side-effect импорт
 * `@labpics/ui-core/<subpath>`, поэтому обёртка приносит элемент с собой.
 */
import { renderElementParts } from '@labpics/ui-core/element-ssr';
import { type DefineComponent, type VNode, defineComponent, h } from 'vue';

/** Способ проброса одного пропа — зеркалит PropKind манифеста. */
export type { LabPropKind, LabPropSpec } from '@labpics/ui-core/adapter-runtime';

/** Описание компонента для фабрики. */
export interface LabComponentSpec {
  /** Спеки проброса, по одной на проп. Имена пропов для Vue выводятся отсюда. */
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
  // Имена объявленных пропов — из спек (одна точка правды, без дубля в манифесте).
  const propNames = spec.specs.map((s) => s.name);
  const component = defineComponent({
    name: `Lab_${tag}`,
    // Натив (aria-label, id, class, data-*, слушатели событий) пробрасываем вручную
    // ниже — отключаем авто-наследование, чтобы не применить дважды.
    inheritAttrs: false,
    props: propNames,
    setup(props: Record<string, unknown>, { slots, attrs }) {
      return () => {
        // Reading the declared inputs during render tracks Vue's reactive props;
        // the shared forwarder owns their initial adoption and subsequent changes.
        const inputs: Record<string, unknown> = {};
        for (const s of spec.specs) inputs[s.name] = props[s.name];
        const server = renderElementParts(tag, {
          specs: spec.specs,
          props: inputs,
          attributes: attrs,
        });
        // Натив и слушатели событий (onValueChange → 'value-change') — сначала,
        // объявленные пропы форсируем ниже своими ключами (пересечений нет: Vue
        // изымает объявленные пропы из attrs).
        const bindings: Record<string, unknown> = {
          ...server?.attributes,
          ...attrs,
          ...(!server && { [`.${LAB_INPUTS_PROPERTY}`]: { specs: spec.specs, props: inputs } }),
        };
        // Named fragments retain framework-owned children. The native projection
        // forwards only root styles explicitly supplied by the receiving component.
        const children: unknown[] = [];
        if (server?.shadowRoot)
          children.push(
            h('template', {
              ...server.shadowRoot.attributes,
              innerHTML: server.shadowRoot.contents,
            }),
          );
        for (const [name, slotFn] of Object.entries(slots)) {
          if (!slotFn) continue;
          if (name === 'default') children.push(slotFn());
          else
            children.push(
              h('lab-slot', { key: name, slot: name }, [
                ...(server
                  ? [h('template', { shadowrootmode: 'open', innerHTML: slotProjectionShadow })]
                  : []),
                slotFn(),
              ]),
            );
        }
        return h(tag, bindings, children as VNode[]);
      };
    },
  });
  // Каст стирает Props/Events на границе фабрики (рантайм оперирует Record). Типовая
  // гарантия — на этапе ГЕНЕРАЦИИ: тип `Props` (Pick<LabX, …>) и массив `specs`
  // co-генерируются из одного манифеста, поэтому разойтись не могут.
  return component as unknown as LabComponent<Props, Events>;
}
