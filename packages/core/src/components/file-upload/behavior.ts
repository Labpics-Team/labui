import * as upload from '@zag-js/file-upload';
import {
  getAcceptAttrString,
  isFileEqual,
  isValidFileSize,
  isValidFileType,
} from '@zag-js/file-utils';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';

export type { FileChangeDetails, FileRejectDetails, FileRejection } from '@zag-js/file-upload';
type ZagFileUploadSchema = SchemaOf<upload.Service>;
export type FileUploadSchema = Omit<ZagFileUploadSchema, 'props'> & {
  props: ZagFileUploadSchema['props'] & { multiple?: boolean };
};
export type FileUploadApi = upload.Api & { resetFiles(files: File[]): void; getFiles(): File[] };
const directories = new WeakSet<File>();
const fileIdentities = new WeakMap<File, number>();
let nextFileIdentity = 0;
function fileIdentity(file: File): number {
  let identity = fileIdentities.get(file);
  if (identity === undefined) {
    identity = ++nextFileIdentity;
    fileIdentities.set(file, identity);
  }
  return identity;
}

function droppedFiles(transfer: DataTransfer): File[] {
  const items = Array.from(transfer.items).filter((item) => item.kind === 'file');
  if (!items.length) return Array.from(transfer.files);
  return items.flatMap((item) => {
    const file = item.getAsFile();
    if (!file) return [];
    // Entry metadata distinguishes directories from legitimate empty files.
    // No traversal or file content access is needed for this selection control.
    if (item.webkitGetAsEntry?.()?.isDirectory) directories.add(file);
    return [file];
  });
}

/** Keep the browser's submitted FileList equal to the accepted selection, including
 * cancelled pickers and controlled requests the application did not accept. */
export function syncFileInput(input: HTMLInputElement, files: readonly File[]): void {
  const current = input.files;
  if (current?.length === files.length && files.every((file, i) => current[i] === file)) return;
  const Transfer = input.ownerDocument.defaultView?.DataTransfer;
  if (!Transfer) return;
  const transfer = new Transfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
}

export function fileUploadMessage(errors: readonly string[]): string {
  return errors
    .map(
      (error) =>
        ({
          FILE_INVALID_TYPE: 'File type is not accepted.',
          FILE_TOO_LARGE: 'File is too large.',
          FILE_TOO_SMALL: 'File is too small.',
          TOO_MANY_FILES: 'Too many files.',
          FILE_EXISTS: 'File is already selected.',
          DIRECTORY_NOT_SUPPORTED: 'Folders cannot be selected. Choose files instead.',
        })[error] ?? 'File could not be selected.',
    )
    .join(' ');
}

/** One native reset listener follows explicit form= associations and respects
 * cancelled resets. The getter reads the latest controlled state at delivery. */
export function listenFileReset(input: HTMLInputElement, reset: () => void): () => void {
  let alive = true;
  const listener = (event: Event) => {
    if (event.target !== input.form) return;
    setTimeout(() => {
      if (alive && input.isConnected && !event.defaultPrevented && event.target === input.form)
        reset();
    });
  };
  input.ownerDocument.addEventListener('reset', listener, true);
  return () => {
    alive = false;
    input.ownerDocument.removeEventListener('reset', listener, true);
  };
}

/** File input's cancel event is not consistently delegated by UI renderers. */
export function listenFileCancel(
  input: HTMLInputElement,
  files: () => readonly File[],
): () => void {
  const cancel = () => syncFileInput(input, files());
  input.addEventListener('cancel', cancel);
  return () => input.removeEventListener('cancel', cancel);
}

export function focusFilePicker(container: ParentNode): void {
  const target = container.querySelector<HTMLElement>(
    '.lab-upload-trigger:not(:disabled), .lab-upload-browse:not([disabled])',
  );
  (target?.shadowRoot?.querySelector<HTMLElement>('button') ?? target)?.focus();
}

export const fileUploadBehavior: MachineModule<FileUploadSchema, FileUploadApi> = {
  machine: {
    ...upload.machine,
    props(params) {
      const props = upload.machine.props?.(params);
      if (!props) throw new Error('File Upload machine must normalize its props');
      return {
        ...props,
        multiple: params.props.multiple ?? false,
        validate(file, details) {
          return directories.has(file)
            ? ['DIRECTORY_NOT_SUPPORTED']
            : (props.validate?.(file, details) ?? null);
        },
      };
    },
    computed: {
      acceptAttr: ({ prop }) => getAcceptAttrString(prop('accept')),
      multiple: ({ prop }) => prop('multiple') ?? false,
    },
    context({ prop, bindable, getContext }) {
      return {
        acceptedFiles: bindable(() => ({
          defaultValue: prop('defaultAcceptedFiles'),
          value: prop('acceptedFiles'),
          // A replacement File may have the same metadata and different contents.
          isEqual: (a, b) => a.length === b?.length && a.every((file, index) => file === b[index]),
          hash: (files) => files.map(fileIdentity).join(','),
          onChange(files) {
            prop('onFileAccept')?.({ files });
            prop('onFileChange')?.({
              acceptedFiles: files,
              rejectedFiles: getContext().get('rejectedFiles'),
            });
          },
        })),
        rejectedFiles: bindable<upload.FileRejection[]>(() => ({
          defaultValue: [],
          isEqual: (a, b) =>
            a.length === b?.length &&
            a.every(
              (item, index) =>
                item.file === b[index]?.file &&
                item.errors.length === b[index]?.errors.length &&
                item.errors.every((error, i) => error === b[index]?.errors[i]),
            ),
          onChange(files) {
            prop('onFileReject')?.({ files });
            prop('onFileChange')?.({
              acceptedFiles: getContext().get('acceptedFiles'),
              rejectedFiles: files,
            });
          },
        })),
        transforming: bindable(() => ({ defaultValue: false })),
      };
    },
    watch({ track, context, action }) {
      track([() => context.hash('acceptedFiles')], () => action(['syncInputElement']));
    },
    on: {
      ...upload.machine.on,
      'LAB.RESET': { actions: ['resetSelection'] },
    },
    implementations: {
      ...upload.machine.implementations,
      actions: {
        ...upload.machine.implementations?.actions,
        setEventFiles({ context, prop, event }) {
          const previous = context.get('acceptedFiles');
          const accepted: File[] = [];
          const rejected: upload.FileRejection[] = [];
          const multiple = prop('multiple');
          for (const file of event.files as File[]) {
            const [, typeError] = isValidFileType(file, getAcceptAttrString(prop('accept')));
            const [, sizeError] = isValidFileSize(file, prop('minFileSize'), prop('maxFileSize'));
            const errors: upload.FileError[] = [];
            if (typeError) errors.push(typeError);
            if (sizeError) errors.push(sizeError);
            errors.push(
              ...(prop('validate')?.(file, {
                acceptedFiles: previous,
                rejectedFiles: context.get('rejectedFiles'),
              }) ?? []),
            );
            if (
              multiple &&
              (previous.some((other) => isFileEqual(other, file)) ||
                accepted.some((other) => isFileEqual(other, file)))
            )
              errors.push('FILE_EXISTS');
            if (errors.length) rejected.push({ file, errors });
            else accepted.push(file);
          }
          if (
            (multiple ? previous.length : 0) + accepted.length >
            (multiple ? prop('maxFiles') : 1)
          ) {
            rejected.push(...accepted.map((file) => ({ file, errors: ['TOO_MANY_FILES'] })));
            accepted.length = 0;
          }
          if (accepted.length)
            context.set('acceptedFiles', multiple ? [...previous, ...accepted] : accepted);
          context.set('rejectedFiles', rejected);
        },
        resetSelection({ context, event }) {
          context.set('acceptedFiles', event.files);
          context.set('rejectedFiles', []);
        },
        // A trusted click must retain transient user activation (not a rAF).
        openFilePicker({ scope, prop }) {
          const input = scope.getById<HTMLInputElement>(
            prop('ids')?.hiddenInput ?? `file:${scope.id}:input`,
          );
          if (input && !input.matches(':disabled')) input.click();
        },
      },
    },
  },
  connect(service, normalize) {
    const input = () =>
      service.scope.getById<HTMLInputElement>(
        service.prop('ids')?.hiddenInput ?? `file:${service.scope.id}:input`,
      );
    const mutable = () =>
      !service.prop('disabled') && !service.prop('readOnly') && !input()?.matches(':disabled');
    const sync = () => {
      const element = input();
      if (element?.isConnected) syncFileInput(element, service.context.get('acceptedFiles'));
    };
    const guarded = <T extends object>(props: T): T => {
      const result = { ...props };
      for (const [key, value] of Object.entries(props)) {
        if (!key.startsWith('on') || typeof value !== 'function') continue;
        Object.assign(result, {
          [key]: (event: Event) => {
            if (!mutable()) {
              event.preventDefault();
              return;
            }
            value(event);
          },
        });
      }
      return result;
    };
    const api = upload.connect(
      service,
      Object.assign(Object.create(normalize) as typeof normalize, {
        element: (props: Parameters<typeof normalize.element>[0]) =>
          normalize.element(
            guarded({
              ...props,
              ...(props['data-part'] === 'dropzone'
                ? {
                    onDrop(event: {
                      dataTransfer: DataTransfer;
                      preventDefault(): void;
                      stopPropagation(): void;
                    }) {
                      if (!mutable() || !service.prop('allowDrop')) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const files = droppedFiles(event.dataTransfer);
                      service.send({ type: 'DROPZONE.DRAG_LEAVE' });
                      if (files.length) service.send({ type: 'FILE.SELECT', files });
                    },
                  }
                : {}),
            }),
          ),
        button: (props: Parameters<typeof normalize.button>[0]) =>
          normalize.button(
            guarded({
              ...props,
              ...(props['data-part'] === 'item-delete-trigger'
                ? {
                    onClick(event: Parameters<NonNullable<typeof props.onClick>>[0]) {
                      const button = event.currentTarget as HTMLButtonElement;
                      const surface = button.closest('.lab-upload-surface');
                      const root = button.getRootNode() as Document | ShadowRoot;
                      props.onClick?.(event);
                      setTimeout(() => {
                        if (
                          button.isConnected ||
                          !surface?.isConnected ||
                          (root.activeElement && root.activeElement !== button.ownerDocument.body)
                        )
                          return;
                        focusFilePicker(surface);
                      });
                    },
                  }
                : {}),
            }),
          ),
        input: (props: Parameters<typeof normalize.input>[0]) =>
          normalize.input({
            ...guarded(props),
            disabled: service.prop('disabled'),
            onInput(event: Parameters<NonNullable<typeof props.onInput>>[0]) {
              if (mutable()) props.onInput?.(event);
              queueMicrotask(sync);
            },
          }),
      }),
    );
    return {
      ...api,
      getFiles: () => service.context.get('acceptedFiles'),
      resetFiles(files) {
        service.send({ type: 'LAB.RESET', files });
      },
    };
  },
};
