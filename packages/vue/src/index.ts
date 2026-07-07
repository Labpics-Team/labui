/**
 * @labpics/ui-vue — Vue-адаптер LabUI (ADR-0001, A-prime).
 *
 * Vue — НЕ родной рендерер. По A-prime родная реализация одна — React; Vue / Svelte /
 * Solid / Astro поставляются КАК Lit web-components. Компоненты здесь — тонкие обёртки,
 * монтирующие общие `<lab-*>` из @labpics/ui-core и пробрасывающие пропы / события /
 * слоты. Разметка, стили, a11y и поведение живут один раз в ядре и не переписываются.
 *
 * Все обёртки СГЕНЕРИРОВАНЫ из ядра (`src/generated`, покрытие всех 27 компонентов),
 * общая логика проброса — в фабрике (`src/runtime/create-lab-component.ts`).
 * SSR — через отдельный вход `@labpics/ui-vue/ssr`.
 */
export * from './generated/index.js';
export {
  type LabComponent,
  type LabComponentSpec,
  type LabEventHandlers,
  type LabPropKind,
  type LabPropSpec,
  createLabComponent,
} from './runtime/create-lab-component.js';
