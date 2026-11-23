import '../foundation.css';
import '@labpics/ui-core/file-upload';
import type { LabFileUpload } from '@labpics/ui-core/file-upload';
import { FileUpload, type FileUploadProps } from '@labpics/ui-react/file-upload';
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
declare global {
  interface Window {
    fileUploadFixture: {
      lit: LabFileUpload;
      updateReact: (next: Partial<FileUploadProps>) => void;
    };
  }
}
window.fileUploadFixture = {
  lit,
  updateReact(next) {
    props = { ...props, ...next };
    flushSync(render);
  },
};
