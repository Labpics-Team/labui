import '../foundation.css';
import '@labpics/ui-core/file-upload';
import type { LabFileUpload } from '@labpics/ui-core/file-upload';
import type { FileChangeDetails } from '@labpics/ui-core/file-upload/behavior';
import { FileUpload, type FileUploadProps } from '@labpics/ui-react/file-upload';
import { LitElement, html } from 'lit';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

const lit = document.createElement('lab-file-upload');
lit.name = 'files';
lit.label = 'Attachments';
lit.accept = '.txt';
lit.maxFileSize = 1024;
document.querySelector('#lit')?.append(lit);
const reset = document.createElement('button');
reset.type = 'reset';
reset.textContent = 'Reset';
document.querySelector('#lit')?.append(reset);
const root = createRoot(document.querySelector('#react') as HTMLElement);
let props: FileUploadProps = {
  label: 'Attachments',
  name: 'files',
  accept: '.txt',
  maxFileSize: 1024,
};
const render = () =>
  root.render(
    <form id="react-form">
      <h2>React</h2>
      <FileUpload {...props} />
      <button type="reset">Reset</button>
    </form>,
  );
render();

type SelectionSnapshot = { accepted: string[]; rejected: string[] };
const changes: SelectionSnapshot[] = [];
const recordChange = (details: FileChangeDetails) => {
  changes.push({
    accepted: details.acceptedFiles.map((file) => file.name),
    rejected: details.rejectedFiles.map(({ file }) => file.name),
  });
};
const fixedFiles = () => [new File(['fixed'], 'fixed.txt', { type: 'text/plain' })];

class ControlledLitUpload extends LitElement {
  static override properties = { files: { state: true } };
  private declare files: File[];
  constructor() {
    super();
    this.files = fixedFiles();
  }
  override createRenderRoot() {
    return this;
  }
  override render() {
    return html`<lab-file-upload label="Attachments" name="files" accept=".txt" multiple
      .acceptedFiles=${this.files}
      @file-change=${(event: CustomEvent<FileChangeDetails>) => {
        recordChange(event.detail);
        this.files = event.detail.acceptedFiles;
      }}></lab-file-upload>`;
  }
}
customElements.define('controlled-file-upload', ControlledLitUpload);

function ControlledReactUpload() {
  const [files, setFiles] = useState(fixedFiles);
  return (
    <form id="react-form">
      <FileUpload
        label="Attachments"
        name="files"
        accept=".txt"
        multiple
        acceptedFiles={files}
        onFileChange={(details) => {
          recordChange(details);
          setFiles(details.acceptedFiles);
        }}
      />
      <button type="reset">Reset</button>
    </form>
  );
}
declare global {
  interface Window {
    fileUploadFixture: {
      lit: LabFileUpload;
      updateReact: (next: Partial<FileUploadProps>) => void;
      changes: SelectionSnapshot[];
      mountControlled: (renderer: 'lit' | 'react') => Promise<void>;
      recordChanges: (renderer: 'lit' | 'react') => void;
    };
  }
}
window.fileUploadFixture = {
  lit,
  changes,
  async mountControlled(renderer) {
    changes.length = 0;
    if (renderer === 'lit') {
      const parent = new ControlledLitUpload();
      document.querySelector('#lit')?.replaceChildren(parent, reset);
      await parent.updateComplete;
      const field = parent.querySelector('lab-file-upload');
      if (!field) throw new Error('Missing controlled File Upload');
      window.fileUploadFixture.lit = field;
    } else {
      flushSync(() => root.render(<ControlledReactUpload />));
    }
  },
  recordChanges(renderer) {
    changes.length = 0;
    if (renderer === 'lit') {
      lit.addEventListener('file-change', (event) => {
        recordChange((event as CustomEvent<FileChangeDetails>).detail);
      });
    } else window.fileUploadFixture.updateReact({ onFileChange: recordChange });
  },
  updateReact(next) {
    props = { ...props, ...next };
    flushSync(render);
  },
};
