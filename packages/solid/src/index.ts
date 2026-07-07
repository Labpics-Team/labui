/**
 * @labpics/ui-solid — Solid-адаптер LabUI (ADR-0001, A-prime).
 *
 * Solid — НЕ родной рендерер. По A-prime родная реализация одна — React; Solid
 * поставляется КАК Lit web-components. Компоненты здесь — тонкие обёртки, монтирующие
 * общие `<lab-*>` из @labpics/ui-core и пробрасывающие пропы / события / слоты.
 *
 * Все обёртки СГЕНЕРИРОВАНЫ из ядра (`src/generated`, покрытие всех 27 компонентов),
 * общая логика проброса — в фабрике (`src/runtime/create-lab-component.ts`, на
 * рантайм-примитивах Solid, без JSX). SSR — через вход `@labpics/ui-solid/ssr`.
 */
export * from './generated/index.js';
export {
  type LabComponentSpec,
  type LabEventHandlers,
  type LabPropKind,
  type LabPropSpec,
  type LabSolidComponent,
  createLabComponent,
} from './runtime/create-lab-component.js';
