/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/textarea';
import type { LabTextarea } from '@labpics/ui-core/textarea';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-textarea>, взятые прямо из класса ядра (LabTextarea). */
export type TextareaProps = Pick<LabTextarea, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'placeholder' | 'rows' | 'autoResize' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>;

/**
 * <Textarea> — тонкая Vue-обёртка над <lab-textarea>.
 * События: onLabChange, onLabInput.
 */
export const Textarea: LabComponent<TextareaProps, 'lab-change' | 'lab-input'> = createLabComponent<
  TextareaProps,
  'lab-change' | 'lab-input'
>('lab-textarea', {
  props: ['type', 'size', 'label', 'labelHidden', 'helper', 'error', 'value', 'placeholder', 'rows', 'autoResize', 'readonly', 'disabled', 'required', 'invalid', 'name'],
  specs: [
      { name: 'type', attr: 'type', kind: 'string' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'label', attr: 'label', kind: 'string' },
      { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
      { name: 'helper', attr: 'helper', kind: 'string' },
      { name: 'error', attr: 'error', kind: 'string' },
      { name: 'value', attr: 'value', kind: 'string' },
      { name: 'placeholder', attr: 'placeholder', kind: 'string' },
      { name: 'rows', attr: 'rows', kind: 'string' },
      { name: 'autoResize', attr: 'auto-resize', kind: 'boolean' },
      { name: 'readonly', attr: 'readonly', kind: 'boolean' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'required', attr: 'required', kind: 'boolean' },
      { name: 'invalid', attr: 'invalid', kind: 'boolean' },
      { name: 'name', attr: 'name', kind: 'string' },
  ],
  events: ['lab-change', 'lab-input'],
});
