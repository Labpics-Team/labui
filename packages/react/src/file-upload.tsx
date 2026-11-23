'use client';

import { fieldControlAria, fieldPartIds } from '@labpics/ui-core';
import {
  type FileChangeDetails,
  type FileRejectDetails,
  fileUploadBehavior,
  fileUploadMessage,
  focusFilePicker,
  listenFileCancel,
  listenFileReset,
  syncFileInput,
} from '@labpics/ui-core/file-upload/behavior';
import {
  type FileUploadTranslations,
  type LabFileUploadSize,
  type LabFileUploadView,
  fileUploadTranslations,
} from '@labpics/ui-core/file-upload/contract';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from './button.js';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/file-upload.css';

export interface FileUploadProps {
  label: string;
  labelHidden?: boolean;
  view?: LabFileUploadView;
  size?: LabFileUploadSize;
  helper?: ReactNode;
  error?: ReactNode;
  name?: string;
  form?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  minFileSize?: number;
  maxFileSize?: number;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  acceptedFiles?: File[];
  defaultAcceptedFiles?: File[];
  translations?: Partial<FileUploadTranslations>;
  onFileChange?: (details: FileChangeDetails) => void;
  onFileReject?: (details: FileRejectDetails) => void;
}

export function FileUpload({
  label,
  labelHidden = true,
  view = 'input',
  size = 'm',
  helper,
  error,
  name,
  form,
  accept,
  multiple = false,
  maxFiles = Number.POSITIVE_INFINITY,
  minFileSize = 0,
  maxFileSize = Number.POSITIVE_INFINITY,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  acceptedFiles,
  defaultAcceptedFiles,
  translations,
  onFileChange,
  onFileReject,
}: FileUploadProps): ReactNode {
  const id = useId();
  const ids = fieldPartIds(id);
  const words = { ...fileUploadTranslations, ...translations };
  const input = useRef<HTMLInputElement>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const initial = useRef(defaultAcceptedFiles ?? []);
  const sync = useCallback(
    (files: readonly File[]) => {
      const element = input.current;
      if (!element) return;
      syncFileInput(element, files);
      const missing = required && files.length === 0;
      element.setCustomValidity(
        !disabled && !readOnly && (invalid || missing)
          ? typeof error === 'string' && error
            ? error
            : missing
              ? words.requiredSelection
              : words.invalidSelection
          : '',
      );
    },
    [disabled, readOnly, required, invalid, error, words.requiredSelection, words.invalidSelection],
  );
  const api = useZag(fileUploadBehavior, {
    id,
    ids: { hiddenInput: ids.control, label: ids.label },
    accept,
    maxFiles: multiple ? maxFiles : 1,
    multiple,
    minFileSize,
    maxFileSize,
    acceptedFiles,
    defaultAcceptedFiles,
    disabled,
    readOnly,
    required,
    invalid,
    name,
    preventDocumentDrop: false,
    translations: { dropzone: label, deleteFile: (file: File) => words.removeFile(file.name) },
    onFileChange: (details) => {
      sync(acceptedFiles ?? details.acceptedFiles);
      onFileChange?.(details);
    },
    onFileReject: (details) => {
      sync(current.current.api.getFiles());
      onFileReject?.(details);
    },
  });
  const current = useRef({ api, acceptedFiles, sync });
  current.current = { api, acceptedFiles, sync };
  useEffect(() => {
    if (!input.current) return;
    const cancel = listenFileCancel(input.current, () => current.current.api.acceptedFiles);
    const reset = listenFileReset(input.current, () => {
      setValidationAttempted(false);
      const { api, acceptedFiles, sync } = current.current;
      api.resetFiles(acceptedFiles ?? initial.current);
      sync(acceptedFiles ?? initial.current);
    });
    return () => {
      cancel();
      reset();
    };
  }, []);
  useEffect(() => sync(api.acceptedFiles), [api.acceptedFiles, sync]);
  const missing =
    validationAttempted && required && !disabled && !readOnly && api.acceptedFiles.length === 0;
  const shownError = invalid
    ? error || words.invalidSelection
    : missing
      ? words.requiredSelection
      : null;
  const aria = fieldControlAria({
    id,
    required,
    invalid: invalid || missing,
    hasHelper: helper != null && helper !== '',
    hasError: shownError != null && shownError !== '',
  });
  const area = view === 'dropzone';
  const selected = api.acceptedFiles.length > 0;
  const drop = {
    ...api.getDropzoneProps({ disableClick: true }),
    role: 'group',
    tabIndex: undefined,
    'aria-label': label,
  };
  return (
    <div {...api.getRootProps()} data-lab-file-upload="" data-view={view} data-size={size}>
      <label
        {...api.getLabelProps()}
        htmlFor={ids.control}
        className={labelHidden ? 'lab-upload-label lab-upload-hidden' : 'lab-upload-label'}
      >
        {label}
        {required ? ' *' : ''}
      </label>
      <div
        {...drop}
        className="lab-upload-surface"
        data-selected={selected || undefined}
        data-invalid={invalid || missing || undefined}
        aria-describedby={aria['aria-describedby']}
      >
        <input
          {...api.getHiddenInputProps()}
          ref={input}
          form={form}
          disabled={disabled}
          required={required && !readOnly}
          onInvalid={(event) => {
            event.preventDefault();
            setValidationAttempted(true);
            const surface = event.currentTarget.closest('.lab-upload-surface');
            if (surface) focusFilePicker(surface);
          }}
          className="lab-upload-hidden"
        />
        {area ? <span className="lab-upload-artwork" aria-hidden="true" /> : null}
        {selected && !(area && api.dragging) ? (
          <ul className="lab-upload-files" aria-label={words.selectedFiles}>
            {api.acceptedFiles.map((file, index) => (
              <li
                key={`${file.name}:${file.size}:${file.lastModified}:${index}`}
                className={area ? 'lab-upload-file' : 'lab-upload-file lab-upload-input-row'}
              >
                {!area ? <span className="lab-upload-file-icon" aria-hidden="true" /> : null}
                <button
                  className={
                    area
                      ? 'lab-upload-name lab-upload-title lab-upload-trigger'
                      : 'lab-upload-name lab-upload-trigger'
                  }
                  type="button"
                  disabled={disabled || readOnly}
                  aria-label={`${words.chooseFile}: ${file.name}`}
                  onClick={() => api.openFilePicker()}
                >
                  {file.name}
                </button>
                <button {...api.getItemDeleteTriggerProps({ file })} className="lab-upload-remove">
                  {words.remove}
                </button>
              </li>
            ))}
          </ul>
        ) : area ? (
          <>
            <p className="lab-upload-title">{words.dropFiles}</p>
            <span className="lab-upload-or">{words.or}</span>
          </>
        ) : (
          <button
            {...api.getTriggerProps()}
            className="lab-upload-trigger lab-upload-input-row"
            aria-describedby={aria['aria-describedby']}
          >
            <span>{words.chooseFile}</span>
            <span className="lab-upload-empty">{words.empty}</span>
          </button>
        )}
        {area && (!selected || multiple) ? (
          <Button
            className="lab-upload-browse"
            size="l"
            disabled={disabled || readOnly}
            onClick={() => api.openFilePicker()}
          >
            {words.browseFiles}
          </Button>
        ) : null}
      </div>
      {helper ? (
        <span className="lab-upload-helper" id={ids.helper}>
          {helper}
        </span>
      ) : null}
      {shownError ? (
        <span className="lab-upload-error" id={ids.error} role="alert">
          {shownError}
        </span>
      ) : null}
      <output className="lab-upload-error" aria-live="polite">
        {api.rejectedFiles.map((item, index) => (
          <span key={`${item.file.name}:${index}`}>
            {item.file.name}: {fileUploadMessage(item.errors)}
          </span>
        ))}
      </output>
      <output className="lab-upload-hidden" aria-live="polite">
        {api.acceptedFiles.map((file) => file.name).join(', ')}
      </output>
    </div>
  );
}
