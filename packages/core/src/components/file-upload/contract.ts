export type LabFileUploadView = 'input' | 'dropzone';
export type LabFileUploadSize = 's' | 'm' | 'l';

export interface FileUploadTranslations {
  chooseFile: string;
  browseFiles: string;
  empty: string;
  dropFiles: string;
  or: string;
  remove: string;
  selectedFiles: string;
  requiredSelection: string;
  invalidSelection: string;
  removeFile: (name: string) => string;
}

export const fileUploadTranslations: FileUploadTranslations = {
  chooseFile: 'Choose File',
  browseFiles: 'Browse files',
  empty: 'No file chosen',
  dropFiles: 'Drag and drop files here',
  or: 'or',
  remove: 'Remove',
  selectedFiles: 'Selected files',
  requiredSelection: 'Choose a file.',
  invalidSelection: 'Invalid file selection.',
  removeFile: (name) => `Remove ${name}`,
};
