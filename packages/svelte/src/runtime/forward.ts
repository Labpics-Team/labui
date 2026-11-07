/**
 * Рантайм-хелперы проброса для сгенерированных Svelte-обёрток (ADR-0001, A-prime).
 *
 * Компилируемый `.svelte`-шаблон не может держать общую фабрику, но общую ЛОГИКУ
 * проброса держит здесь. Начальные Boolean-свойства передаются до вставки узла;
 * последующие значения — через `$effect`. Спреда `{...rest}`
 * для объявленных пропов недостаточно: camelCase-проп (htmlType) ушёл бы атрибутом
 * `htmlType`, а элемент наблюдает `html-type`. Оба пути читают одну спеку имён
 * и типов; первоначальный snapshot содержит только Boolean-свойства.
 */

/** Способ проброса одного пропа — зеркалит PropKind манифеста. */
export type LabPropKind = 'boolean' | 'prop' | 'string';

/** Спека проброса одного пропа. */
export interface LabPropSpec {
  readonly name: string;
  readonly attr: string;
  readonly kind: LabPropKind;
}

/** Первоначальные Boolean-пропы для клиентской render-фазы; undefined не задаёт свойство. */
export function initialBooleanProps(
  specs: readonly LabPropSpec[],
  values: Record<string, unknown>,
): Record<string, boolean> {
  const props: Record<string, boolean> = {};
  for (const spec of specs) {
    const value = values[spec.name];
    if (spec.kind === 'boolean' && value !== undefined) props[spec.name] = Boolean(value);
  }
  return props;
}

/**
 * Форвардит объявленные пропы на элемент по их видам:
 *   - 'prop'    → JS-свойство (массивы/объекты/контролируемые значения);
 *   - 'boolean' → JS-свойство; false задан явно, undefined оставляет текущее значение;
 *   - 'string'  → строковый атрибут (nullish снимает атрибут → дефолт элемента).
 */
export function forwardDeclared(
  el: HTMLElement | undefined,
  specs: readonly LabPropSpec[],
  values: Record<string, unknown>,
): void {
  if (!el) return;
  for (const spec of specs) {
    const value = values[spec.name];
    if (spec.kind === 'prop') {
      if (value !== undefined) (el as unknown as Record<string, unknown>)[spec.name] = value;
    } else if (spec.kind === 'boolean') {
      if (value !== undefined)
        (el as unknown as Record<string, unknown>)[spec.name] = Boolean(value);
    } else if (value === undefined || value === null) {
      el.removeAttribute(spec.attr);
    } else {
      el.setAttribute(spec.attr, String(value));
    }
  }
}

/**
 * Вешает кастом-события на элемент; возвращает cleanup (используется как возврат
 * `$effect`). Слушатель ставится только для заданных обработчиков — undefined
 * молча пропускается.
 */
export function forwardEvents(
  el: HTMLElement | undefined,
  handlers: Record<string, ((event: CustomEvent) => void) | undefined>,
): (() => void) | undefined {
  if (!el) return undefined;
  const attached: Array<[string, EventListener]> = [];
  for (const [event, handler] of Object.entries(handlers)) {
    if (typeof handler === 'function') {
      el.addEventListener(event, handler as EventListener);
      attached.push([event, handler as EventListener]);
    }
  }
  return () => {
    for (const [event, handler] of attached) el.removeEventListener(event, handler);
  };
}
