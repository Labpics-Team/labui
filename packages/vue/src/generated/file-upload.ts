/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/file-upload';
import type { LabFileUpload } from '@labpics/ui-core/file-upload';

/** Пропы <lab-file-upload>, взятые прямо из класса ядра (LabFileUpload). */
export type FileUploadProps = Pick<LabFileUpload, 'view' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'name' | 'accept' | 'multiple' | 'maxFiles' | 'maxFileSize' | 'minFileSize' | 'disabled' | 'readonly' | 'required' | 'invalid' | 'acceptedFiles' | 'defaultAcceptedFiles' | 'translations'>;

/**
 * <FileUpload> — тонкая Vue-обёртка над <lab-file-upload>.
 * События: onFileChange, onFileReject.
 */
export const FileUpload: LabComponent<FileUploadProps, 'file-change' | 'file-reject'> = createLabComponent<
  FileUploadProps,
  'file-change' | 'file-reject'
>('lab-file-upload', {
  specs: [
      { name: 'view', attr: 'view', kind: 'string' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'label', attr: 'label', kind: 'string' },
      { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
      { name: 'helper', attr: 'helper', kind: 'string' },
      { name: 'error', attr: 'error', kind: 'string' },
      { name: 'name', attr: 'name', kind: 'string' },
      { name: 'accept', attr: 'accept', kind: 'string' },
      { name: 'multiple', attr: 'multiple', kind: 'boolean' },
      { name: 'maxFiles', attr: 'max-files', kind: 'string' },
      { name: 'maxFileSize', attr: 'max-file-size', kind: 'string' },
      { name: 'minFileSize', attr: 'min-file-size', kind: 'string' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'readonly', attr: 'readonly', kind: 'boolean' },
      { name: 'required', attr: 'required', kind: 'boolean' },
      { name: 'invalid', attr: 'invalid', kind: 'boolean' },
      { name: 'acceptedFiles', attr: 'acceptedFiles', kind: 'prop' },
      { name: 'defaultAcceptedFiles', attr: 'defaultAcceptedFiles', kind: 'prop' },
      { name: 'translations', attr: 'translations', kind: 'prop' },
  ],
  events: ['file-change', 'file-reject'],
});
