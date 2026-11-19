/**
 * @labpics/ui-svelte — Svelte 5-адаптер LabUI (ADR-0001, A-prime).
 *
 * Svelte — НЕ родной рендерер. По A-prime родная реализация одна — React; Svelte
 * поставляется КАК Lit web-components. Компоненты здесь — тонкие обёртки, монтирующие
 * общие `<lab-*>` из @labpics/ui-core и пробрасывающие пропы / события / слоты.
 *
 * Все обёртки СГЕНЕРИРОВАНЫ из ядра (`src/generated/*.svelte`),
 * общая логика проброса — в рантайм-хелперах (`src/runtime/forward.ts`).
 * Обычный Svelte SSR сохраняет host/snippets Svelte и добавляет DSD ядра;
 * `/ssr` возвращает статические HTML-фрагменты.
 */
export * from './generated/index.js';
export {
  type LabPropKind,
  type LabPropSpec,
  forwardDeclared,
  forwardEvents,
} from './runtime/forward.js';
