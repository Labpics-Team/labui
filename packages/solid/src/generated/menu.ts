/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/menu';
import type { LabMenu } from '@labpics/ui-core/menu';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-menu>, взятые прямо из класса ядра (LabMenu). */
export type MenuProps = Pick<LabMenu, 'size' | 'placement' | 'disabled' | 'label' | 'items'>;

/** <Menu> — тонкая Solid-обёртка над <lab-menu>. */
export const Menu: LabSolidComponent<MenuProps, 'open-change' | 'select'> = createLabComponent<
  MenuProps,
  'open-change' | 'select'
>('lab-menu', {
  specs: [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ],
  events: ['open-change', 'select'],
});
