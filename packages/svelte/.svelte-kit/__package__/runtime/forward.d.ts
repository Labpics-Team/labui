/**
 * Рантайм-хелперы проброса для сгенерированных Svelte-обёрток (ADR-0001, A-prime).
 *
 * Компилируемый `.svelte`-шаблон не может держать общую фабрику, но общую ЛОГИКУ
 * проброса держит здесь: каждый сгенерированный компонент зовёт эти функции в
 * `$effect`, а не повторяет правила «атрибут vs свойство» у себя. Спреда `{...rest}`
 * для объявленных пропов недостаточно: camelCase-проп (htmlType) ушёл бы атрибутом
 * `htmlType`, а элемент наблюдает `html-type` — поэтому объявленные пропы всегда
 * форвардим здесь по спекам, а спредим только нативные атрибуты.
 */
/** Способ проброса одного пропа — зеркалит PropKind манифеста. */
export type LabPropKind = 'boolean' | 'prop' | 'string';
/** Спека проброса одного пропа. */
export interface LabPropSpec {
    readonly name: string;
    readonly attr: string;
    readonly kind: LabPropKind;
}
/**
 * Форвардит объявленные пропы на элемент по их видам:
 *   - 'prop'    → JS-свойство (массивы/объекты/контролируемые значения);
 *   - 'boolean' → атрибут-флаг (present/absent), голый false не даёт attr="false";
 *   - 'string'  → строковый атрибут (nullish снимает атрибут → дефолт элемента).
 */
export declare function forwardDeclared(el: HTMLElement | undefined, specs: readonly LabPropSpec[], values: Record<string, unknown>): void;
/**
 * Вешает кастом-события на элемент; возвращает cleanup (используется как возврат
 * `$effect`). Слушатель ставится только для заданных обработчиков — undefined
 * молча пропускается.
 */
export declare function forwardEvents(el: HTMLElement | undefined, handlers: Record<string, ((event: CustomEvent) => void) | undefined>): (() => void) | undefined;
//# sourceMappingURL=forward.d.ts.map