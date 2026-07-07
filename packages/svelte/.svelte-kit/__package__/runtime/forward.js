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
/**
 * Форвардит объявленные пропы на элемент по их видам:
 *   - 'prop'    → JS-свойство (массивы/объекты/контролируемые значения);
 *   - 'boolean' → атрибут-флаг (present/absent), голый false не даёт attr="false";
 *   - 'string'  → строковый атрибут (nullish снимает атрибут → дефолт элемента).
 */
export function forwardDeclared(el, specs, values) {
    if (!el)
        return;
    for (const spec of specs) {
        const value = values[spec.name];
        if (spec.kind === 'prop') {
            if (value !== undefined)
                el[spec.name] = value;
        }
        else if (spec.kind === 'boolean') {
            el.toggleAttribute(spec.attr, Boolean(value));
        }
        else if (value === undefined || value === null) {
            el.removeAttribute(spec.attr);
        }
        else {
            el.setAttribute(spec.attr, String(value));
        }
    }
}
/**
 * Вешает кастом-события на элемент; возвращает cleanup (используется как возврат
 * `$effect`). Слушатель ставится только для заданных обработчиков — undefined
 * молча пропускается.
 */
export function forwardEvents(el, handlers) {
    if (!el)
        return undefined;
    const attached = [];
    for (const [event, handler] of Object.entries(handlers)) {
        if (typeof handler === 'function') {
            el.addEventListener(event, handler);
            attached.push([event, handler]);
        }
    }
    return () => {
        for (const [event, handler] of attached)
            el.removeEventListener(event, handler);
    };
}
