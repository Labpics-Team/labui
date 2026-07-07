/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/button';
import type { LabButton } from '@labpics/ui-core/button';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-button>, взятые прямо из класса ядра (LabButton). */
export type ButtonProps = Pick<LabButton, 'type' | 'kind' | 'size' | 'icon' | 'loading' | 'disabled' | 'htmlType'>;

/**
 * <Button> — тонкая Vue-обёртка над <lab-button>.
 */
export const Button: LabComponent<ButtonProps, never> = createLabComponent<
  ButtonProps,
  never
>('lab-button', {
  specs: [
      { name: 'type', attr: 'type', kind: 'string' },
      { name: 'kind', attr: 'kind', kind: 'string' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'icon', attr: 'icon', kind: 'boolean' },
      { name: 'loading', attr: 'loading', kind: 'boolean' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'htmlType', attr: 'html-type', kind: 'string' },
  ],
  events: [],
});
