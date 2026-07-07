/**
 * Фабрика тонких Solid-обёрток над Lit web-components (ADR-0001, A-prime).
 *
 * Написана на РАНТАЙМ-примитивах Solid (createComponent / Dynamic / createEffect), а не
 * на JSX: тогда пакет — чистый TS и собирается обычным tsup (без solid-компилятора),
 * а JSX самого потребителя (`<Select .../>`) компилит его же билд. Форвардинг
 * императивный — через ref + createEffect, поэтому undefined-обработчик/проп
 * обрабатывается чисто (атрибут снят, слушатель не повешен). Вид проброса — по PropKind.
 *
 * Регистрация: генерируемый файл делает side-effect импорт @labpics/ui-core/<subpath>.
 */
import {
  type JSX,
  createComponent,
  createEffect,
  createSignal,
  mergeProps,
  onCleanup,
  splitProps,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';

/** Способ проброса одного пропа — зеркалит PropKind манифеста. */
export type LabPropKind = 'boolean' | 'prop' | 'string';

/** Спека проброса одного пропа. */
export interface LabPropSpec {
  readonly name: string;
  readonly attr: string;
  readonly kind: LabPropKind;
}

/** Описание компонента для фабрики. */
export interface LabComponentSpec {
  readonly specs: readonly LabPropSpec[];
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
 * Публичный тип Solid-обёртки: частичные пропы (дефолты у элемента) + типизированные
 * обработчики событий + нативные HTML-атрибуты (aria-label, class, …) + дети.
 */
export type LabSolidComponent<Props, Events extends string> = (
  props: Partial<Props> &
    LabEventHandlers<Events> &
    JSX.HTMLAttributes<HTMLElement> & { children?: JSX.Element },
) => JSX.Element;

/** kebab → Pascal в рантайме (имя обработчика для события). */
function handlerName(event: string): string {
  return `on${event
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')}`;
}

/** Применяет один проп на элемент по его виду. */
function applyProp(el: HTMLElement, spec: LabPropSpec, value: unknown): void {
  if (spec.kind === 'prop') {
    // Массив/объект/контролируемое значение — только JS-свойством.
    if (value !== undefined) (el as unknown as Record<string, unknown>)[spec.name] = value;
  } else if (spec.kind === 'boolean') {
    el.toggleAttribute(spec.attr, Boolean(value));
  } else if (value === undefined || value === null) {
    el.removeAttribute(spec.attr);
  } else {
    el.setAttribute(spec.attr, String(value));
  }
}

/**
 * Создаёт Solid-компонент, монтирующий кастом-элемент `tag` и пробрасывающий на него
 * объявленные пропы (реактивно), нативные атрибуты (spread) и кастом-события.
 */
export function createLabComponent<Props, Events extends string>(
  tag: string,
  spec: LabComponentSpec,
): LabSolidComponent<Props, Events> {
  const propNames = spec.specs.map((s) => s.name);
  const handlerNames = spec.events.map(handlerName);
  return (props) => {
    // el — СИГНАЛ: ref фиксирует элемент, и эффекты переисполняются (иначе эффект
    // сработал бы раз с el=undefined до ref и больше не запустился — проброса бы не было).
    const [el, setEl] = createSignal<HTMLElement>();
    const all = props as Record<string, unknown>;
    // Разделяем: объявленные пропы + обработчики + дети форвардим сами, остальное
    // (нативные атрибуты) спредим на элемент.
    const [, rest] = splitProps(all, [...propNames, ...handlerNames, 'children']);
    // Реактивный проброс объявленных пропов.
    createEffect(() => {
      const node = el();
      if (!node) return;
      for (const s of spec.specs) applyProp(node, s, all[s.name]);
    });
    // Проброс кастом-событий: вешаем только заданные обработчики, снимаем при смене.
    createEffect(() => {
      const node = el();
      if (!node) return;
      const attached: Array<[string, EventListener]> = [];
      for (const event of spec.events) {
        const handler = all[handlerName(event)];
        if (typeof handler === 'function') {
          node.addEventListener(event, handler as EventListener);
          attached.push([event, handler as EventListener]);
        }
      }
      onCleanup(() => {
        for (const [event, handler] of attached) node.removeEventListener(event, handler);
      });
    });
    return createComponent(
      Dynamic,
      mergeProps({ component: tag, ref: setEl }, rest, {
        get children() {
          return (all as { children?: JSX.Element }).children;
        },
      }) as Parameters<typeof Dynamic>[0],
    );
  };
}
