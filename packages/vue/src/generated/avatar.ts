/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/avatar';
import type { LabAvatar } from '@labpics/ui-core/avatar';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-avatar>, взятые прямо из класса ядра (LabAvatar). */
export type AvatarProps = Pick<LabAvatar, 'size' | 'color' | 'status' | 'src' | 'name'>;

/**
 * <Avatar> — тонкая Vue-обёртка над <lab-avatar>.
 */
export const Avatar: LabComponent<AvatarProps, never> = createLabComponent<
  AvatarProps,
  never
>('lab-avatar', {
  props: ['size', 'color', 'status', 'src', 'name'],
  specs: [
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'color', attr: 'color', kind: 'string' },
      { name: 'status', attr: 'status', kind: 'string' },
      { name: 'src', attr: 'src', kind: 'string' },
      { name: 'name', attr: 'name', kind: 'string' },
  ],
  events: [],
});
