/**
 * Рантайм-хелперы проброса для сгенерированных Svelte-обёрток (ADR-0001, A-prime).
 *
 * Компилируемый `.svelte`-шаблон не может держать общую фабрику, но общую ЛОГИКУ
 * проброса держит здесь: DOM input binding применяет props до connection,
 * `$effect` ведёт события. Правила «атрибут vs свойство» не дублируются. Спреда `{...rest}`
 * для объявленных пропов недостаточно: camelCase-проп (htmlType) ушёл бы атрибутом
 * `htmlType`, а элемент наблюдает `html-type` — поэтому объявленные пропы всегда
 * форвардим здесь по спекам, а спредим только нативные атрибуты.
 */

/** Способ проброса одного пропа — зеркалит PropKind манифеста. */
export {
  LAB_INPUTS_PROPERTY,
  forwardDeclared,
  type LabPropKind,
  type LabPropSpec,
} from '@labpics/ui-core/adapter-runtime';

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
