import '@labpics/ui-core/file-upload';
import type { ComponentDoc } from '../template/component-doc.js';

function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-file-upload');
  element.label = 'Attachments';
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  return element;
}

export const fileUploadDoc: ComponentDoc = {
  slug: 'file-upload',
  order: 15,
  tag: 'lab-file-upload',
  title: 'File Upload',
  summary:
    'Выбор файлов через компактное поле или область переноса. Настоящий системный диалог, проверка типа и размера, удаление, сброс и участие в форме. Отправку на сервер выполняет приложение.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'View',
        attribute: 'view',
        options: [
          { label: 'Input', value: 'input' },
          { label: 'Dropzone', value: 'dropzone' },
        ],
      },
      {
        name: 'Size',
        attribute: 'size',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
        ],
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Field',
      description:
        'Настоящая кнопка открывает системный выбор. Область дополнительно принимает перенесённые файлы.',
    },
    {
      index: 2,
      name: 'Selection',
      description: 'Имя выбранного файла и действие удаления. Нажатие имени снова открывает выбор.',
    },
    {
      index: 3,
      name: 'Feedback',
      description:
        'Подсказка, ошибка приложения и причины отклонения файлов связаны с полем и доступны скринридеру.',
    },
  ],
  meaning: {
    purpose:
      'Добавить один или несколько локальных файлов к форме. Компонент сохраняет файловые объекты; приложение управляет сетевой отправкой.',
    dos: [
      'Укажите понятное название поля.',
      'Покажите ограничения рядом с выбором.',
      'Обрабатывайте передачу и ошибки сервера в приложении.',
    ],
    donts: [
      'Не считайте выбор файла успешной отправкой.',
      'Не читайте содержимое большого файла ради отображения имени.',
    ],
  },
  liveExample: {
    make: () =>
      make({
        view: 'dropzone',
        accept: '.pdf,.txt',
        multiple: true,
        'max-files': '5',
        helper: 'PDF или TXT, до пяти файлов.',
      }),
    controls: [
      {
        kind: 'select',
        label: 'View',
        attribute: 'view',
        options: [
          { label: 'Input', value: 'input' },
          { label: 'Dropzone', value: 'dropzone' },
        ],
      },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
      { kind: 'toggle', label: 'Read only', attribute: 'readonly' },
      { kind: 'toggle', label: 'Required', attribute: 'required' },
    ],
  },
  api: {
    props: [
      {
        name: 'view',
        type: "'input' | 'dropzone'",
        default: "'input'",
        description: 'Компактное поле или область с авторской иллюстрацией.',
      },
      {
        name: 'acceptedFiles / defaultAcceptedFiles',
        type: 'File[]',
        description: 'Управляемый или начальный выбор файлов; JavaScript-свойства.',
      },
      { name: 'accept', type: 'string', description: 'Разрешённые расширения или MIME-типы.' },
      {
        name: 'multiple / maxFiles / maxFileSize',
        type: 'boolean / number / number',
        description: 'Число файлов и максимальный размер одного файла в байтах.',
      },
      { name: 'name', type: 'string', description: 'Имя ключа для File в нативном FormData.' },
    ],
    events: [
      {
        name: 'file-change',
        type: '{ acceptedFiles: File[], rejectedFiles: FileRejection[] }',
        description: 'Запрос изменения выбора.',
      },
      {
        name: 'file-reject',
        type: '{ files: FileRejection[] }',
        description: 'Причины отказа для каждого отклонённого файла.',
      },
    ],
    slots: [],
  },
};
