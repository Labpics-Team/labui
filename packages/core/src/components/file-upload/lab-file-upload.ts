import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import { fieldControlAria, fieldPartIds } from '../field/field-a11y.js';
import '../button/index.js';
import {
  type FileChangeDetails,
  type FileRejectDetails,
  type FileUploadApi,
  type FileUploadSchema,
  fileUploadBehavior,
  fileUploadMessage,
  focusFilePicker,
  listenFileCancel,
  syncFileInput,
} from './behavior.js';
import {
  type FileUploadTranslations,
  type LabFileUploadSize,
  type LabFileUploadView,
  fileUploadTranslations,
} from './contract.js';
import { fileUploadCss } from './styles.js';

export type { LabFileUploadSize, LabFileUploadView, FileUploadTranslations } from './contract.js';
let sequence = 0;

export class LabFileUpload extends LabElement {
  static formAssociated = true;
  static override properties = {
    view: { reflect: true },
    size: { reflect: true },
    label: {},
    labelHidden: { type: Boolean, attribute: 'label-hidden' },
    helper: {},
    error: {},
    name: { reflect: true },
    accept: {},
    multiple: { type: Boolean },
    maxFiles: { type: Number, attribute: 'max-files' },
    maxFileSize: { type: Number, attribute: 'max-file-size' },
    minFileSize: { type: Number, attribute: 'min-file-size' },
    disabled: { type: Boolean, reflect: true },
    readonly: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    invalid: { type: Boolean, reflect: true },
    acceptedFiles: { attribute: false },
    defaultAcceptedFiles: { attribute: false },
    translations: { attribute: false },
    disabledByForm: { state: true },
    validationAttempted: { state: true },
  };
  declare view: LabFileUploadView;
  declare size: LabFileUploadSize;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare name: string;
  declare accept: string;
  declare multiple: boolean;
  declare maxFiles: number;
  declare maxFileSize: number;
  declare minFileSize: number;
  declare disabled: boolean;
  declare readonly: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare acceptedFiles: File[] | null;
  declare defaultAcceptedFiles: File[];
  declare translations: Partial<FileUploadTranslations>;
  private declare disabledByForm: boolean;
  private declare validationAttempted: boolean;
  private readonly internals?: ElementInternals;
  private readonly fieldId = `lab-file-upload-${++sequence}`;
  private readonly ctl: ZagController<FileUploadSchema, FileUploadApi>;
  private initialFiles?: File[];
  private disconnectedFiles?: File[];
  private stopCancel?: () => void;

  constructor() {
    super();
    this.view = 'input';
    this.size = 'm';
    this.label = 'Files';
    this.labelHidden = true;
    this.helper = '';
    this.error = '';
    this.name = '';
    this.accept = '';
    this.multiple = false;
    this.maxFiles = Number.POSITIVE_INFINITY;
    this.maxFileSize = Number.POSITIVE_INFINITY;
    this.minFileSize = 0;
    this.disabled = false;
    this.readonly = false;
    this.required = false;
    this.invalid = false;
    this.disabledByForm = false;
    this.validationAttempted = false;
    this.acceptedFiles = null;
    this.defaultAcceptedFiles = [];
    this.translations = {};
    this.addEventListener('invalid', (event) => {
      event.preventDefault();
      this.validationAttempted = true;
      focusFilePicker(this.renderRoot);
    });
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
    this.ctl = this.runMachine(fileUploadBehavior, () => ({
      id: this.fieldId,
      ids: {
        hiddenInput: fieldPartIds(this.fieldId).control,
        label: fieldPartIds(this.fieldId).label,
      },
      accept: this.accept || undefined,
      maxFiles: this.multiple ? this.maxFiles : 1,
      minFileSize: this.minFileSize,
      maxFileSize: this.maxFileSize,
      acceptedFiles: this.acceptedFiles ?? undefined,
      defaultAcceptedFiles: this.disconnectedFiles ?? this.defaultAcceptedFiles,
      disabled: this.disabled || this.disabledByForm,
      readOnly: this.readonly,
      required: this.required,
      invalid: this.invalid,
      preventDocumentDrop: false,
      translations: {
        dropzone: this.label,
        deleteFile: (file: File) => this.words.removeFile(file.name),
      },
      onFileChange: (detail: FileChangeDetails) => {
        this.syncForm(this.acceptedFiles ?? detail.acceptedFiles);
        this.dispatchEvent(
          new CustomEvent<FileChangeDetails>('file-change', {
            detail,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onFileReject: (detail: FileRejectDetails) => {
        this.syncForm(this.ctl.api.getFiles());
        this.dispatchEvent(
          new CustomEvent<FileRejectDetails>('file-reject', {
            detail,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }
  private get words(): FileUploadTranslations {
    return { ...fileUploadTranslations, ...this.translations };
  }
  private get shownError(): string {
    if (this.invalid) return this.error || this.words.invalidSelection;
    return this.validationAttempted &&
      this.required &&
      !this.disabled &&
      !this.disabledByForm &&
      !this.readonly &&
      this.files.length === 0
      ? this.words.requiredSelection
      : '';
  }
  get files(): readonly File[] {
    try {
      return this.ctl.api.getFiles();
    } catch {
      return this.acceptedFiles ?? this.disconnectedFiles ?? this.defaultAcceptedFiles;
    }
  }
  get form(): HTMLFormElement | null {
    return this.internals?.form ?? null;
  }
  get validity(): ValidityState | undefined {
    return this.internals?.validity;
  }
  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? true;
  }
  openFilePicker(): void {
    this.ctl.api.openFilePicker();
  }
  clearFiles(): void {
    this.ctl.api.clearFiles();
  }
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    this.validationAttempted = false;
    if (this.acceptedFiles === null) this.ctl.api.resetFiles(this.initialFiles ?? []);
    else this.ctl.api.resetFiles(this.acceptedFiles);
    this.syncForm(this.acceptedFiles ?? this.initialFiles ?? []);
  }
  override disconnectedCallback(): void {
    this.disconnectedFiles = [...this.files];
    this.stopCancel?.();
    this.stopCancel = undefined;
    super.disconnectedCallback();
  }
  private syncForm(files: readonly File[]): void {
    const disabled = this.disabled || this.disabledByForm;
    const data = new FormData();
    if (this.name && !disabled) for (const file of files) data.append(this.name, file);
    this.internals?.setFormValue(disabled ? null : data);
    const input = this.renderRoot.querySelector<HTMLInputElement>('input[type=file]');
    if (input) syncFileInput(input, files);
    const missing = !disabled && !this.readonly && this.required && files.length === 0;
    this.internals?.setValidity(
      missing
        ? { valueMissing: true }
        : !disabled && !this.readonly && this.invalid
          ? { customError: true }
          : {},
      missing
        ? this.words.requiredSelection
        : !disabled && !this.readonly && this.invalid
          ? this.error || this.words.invalidSelection
          : '',
      input ?? undefined,
    );
  }
  static override styles = [
    unsafeCSS(fileUploadCss),
    css`:host { display:block; min-inline-size:0; }`,
  ];

  override updated(_changed: PropertyValues): void {
    this.initialFiles ??= [...this.defaultAcceptedFiles];
    const api = this.ctl.api;
    const root = this.renderRoot;
    const spread = (selector: string, props: Record<string, unknown>) => {
      const node = root.querySelector(selector);
      if (node) this.ctl.spread(node, props);
    };
    spread('[data-lab-file-upload]', api.getRootProps());
    spread('.lab-upload-label', api.getLabelProps());
    // A group contains real buttons. It is not a second nested button/application.
    const drop = {
      ...api.getDropzoneProps({ disableClick: true }),
      role: 'group',
      tabIndex: undefined,
      'aria-label': this.label,
      'data-invalid': this.shownError ? '' : undefined,
    };
    spread('.lab-upload-surface', drop);
    spread('.lab-upload-input-row.lab-upload-trigger', api.getTriggerProps());
    const input = root.querySelector<HTMLInputElement>('input[type=file]');
    if (input) {
      this.ctl.spread(input, api.getHiddenInputProps());
      input.disabled = this.disabled || this.disabledByForm;
      this.stopCancel ??= listenFileCancel(input, () => this.files);
    }
    root.querySelectorAll<HTMLButtonElement>('.lab-upload-remove').forEach((button, index) => {
      const file = api.acceptedFiles[index];
      if (file) this.ctl.spread(button, api.getItemDeleteTriggerProps({ file }));
    });
    this.syncForm(api.acceptedFiles);
  }
  override render(): TemplateResult {
    const ids = fieldPartIds(this.fieldId);
    const words = this.words;
    let api: FileUploadApi | undefined;
    try {
      api = this.ctl.api;
    } catch {}
    const files = api?.acceptedFiles ?? this.files;
    const rejected = api?.rejectedFiles ?? [];
    const disabled = this.disabled || this.disabledByForm;
    const aria = fieldControlAria({
      id: this.fieldId,
      required: this.required,
      invalid: !!this.shownError,
      hasHelper: !!this.helper,
      hasError: !!this.shownError,
    });
    const selected = files.length > 0;
    const area = this.view === 'dropzone';
    return html`<div data-lab-file-upload data-view=${this.view} data-size=${this.size}>
      <label class=${this.labelHidden ? 'lab-upload-label lab-upload-hidden' : 'lab-upload-label'} id=${ids.label} for=${ids.control}>${this.label}${this.required ? ' *' : ''}</label>
      <div class="lab-upload-surface" part="surface" role="group" aria-label=${this.label}
        ?data-disabled=${disabled} ?data-readonly=${this.readonly} ?data-invalid=${!!this.shownError} ?data-selected=${selected}
        ?data-dragging=${api?.dragging} aria-describedby=${aria['aria-describedby'] ?? nothing}>
        <input class="lab-upload-hidden" id=${ids.control} type="file" ?disabled=${disabled} ?multiple=${this.multiple} accept=${this.accept} tabindex="-1" aria-hidden="true" />
        ${area ? html`<span class="lab-upload-artwork" aria-hidden="true"></span>` : nothing}
        ${
          selected && !(area && api?.dragging)
            ? html`<ul class="lab-upload-files" aria-label=${words.selectedFiles}>${files.map(
                (
                  file,
                ) => html`<li class=${area ? 'lab-upload-file' : 'lab-upload-file lab-upload-input-row'}>
          ${!area ? html`<span class="lab-upload-file-icon" aria-hidden="true"></span>` : nothing}
          <button class=${area ? 'lab-upload-name lab-upload-title lab-upload-trigger' : 'lab-upload-name lab-upload-trigger'} type="button" ?disabled=${disabled || this.readonly} aria-label=${`${words.chooseFile}: ${file.name}`} @click=${() => this.ctl.api.openFilePicker()}>${file.name}</button>
          <button type="button" class="lab-upload-remove" ?disabled=${disabled || this.readonly} aria-label=${words.removeFile(file.name)}>${words.remove}</button>
        </li>`,
              )}</ul>`
            : area
              ? html`<p class="lab-upload-title">${words.dropFiles}</p><span class="lab-upload-or">${words.or}</span>`
              : html`
          <button class="lab-upload-trigger lab-upload-input-row" type="button" ?disabled=${disabled || this.readonly} aria-describedby=${aria['aria-describedby'] ?? nothing}>
            <span>${words.chooseFile}</span><span class="lab-upload-empty">${words.empty}</span>
          </button>`
        }
        ${area && (!selected || this.multiple) ? html`<lab-button class="lab-upload-browse" size="l" ?disabled=${disabled || this.readonly} @click=${() => this.ctl.api.openFilePicker()}>${words.browseFiles}</lab-button>` : nothing}
      </div>
      ${this.helper ? html`<span class="lab-upload-helper" id=${ids.helper}>${this.helper}</span>` : nothing}
      ${this.shownError ? html`<span class="lab-upload-error" id=${ids.error} role="alert">${this.shownError}</span>` : nothing}
      <div class="lab-upload-error" role="status" aria-live="polite">${rejected.map((item) => html`<div>${item.file.name}: ${fileUploadMessage(item.errors)}</div>`)}</div>
      <span class="lab-upload-hidden" role="status" aria-live="polite">${files.map((file) => file.name).join(', ')}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-file-upload': LabFileUpload;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-file-upload'))
  customElements.define('lab-file-upload', LabFileUpload);
