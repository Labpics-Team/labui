import { VanillaMachine, normalizeProps } from '@zag-js/vanilla';
import { describe, expect, it } from 'vitest';
import {
  type FileChangeDetails,
  fileUploadBehavior,
} from '../src/components/file-upload/behavior.js';

describe('File Upload selection API', () => {
  it('notifies once with both lists for set, rejected removal, clear and reset', async () => {
    const fixed = new File(['fixed'], 'fixed.txt', { type: 'text/plain' });
    const good = new File(['good'], 'good.txt', { type: 'text/plain' });
    const bad = new File(['bad'], 'bad.png', { type: 'image/png' });
    const changes: FileChangeDetails[] = [];
    const machine = new VanillaMachine(fileUploadBehavior.machine, {
      id: 'selection-api',
      accept: '.txt',
      multiple: true,
      acceptedFiles: [fixed],
      preventDocumentDrop: false,
      // This test exercises the public selection API without creating a field.
      getRootNode: () => ({ getElementById: () => null }) as unknown as Document,
      onFileChange(selection) {
        changes.push(selection);
        queueMicrotask(() => machine.updateProps({ acceptedFiles: selection.acceptedFiles }));
      },
    });
    const api = () => fileUploadBehavior.connect(machine.service, normalizeProps);
    const check = async (accepted: File[], rejected: File[]) => {
      // Vanilla sends and the controlled parent both commit on their next microtask.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(changes).toHaveLength(1);
      expect(changes[0]?.acceptedFiles).toEqual(accepted);
      expect(changes[0]?.rejectedFiles.map(({ file }) => file)).toEqual(rejected);
      expect(api().acceptedFiles).toEqual(accepted);
      expect(api().rejectedFiles.map(({ file }) => file)).toEqual(rejected);
      changes.length = 0;
    };
    machine.start();
    try {
      api().setFiles([good, bad]);
      await check([good], [bad]);
      api().deleteFile(bad, 'rejected');
      await check([good], []);
      api().setFiles([good, bad]);
      await check([good], [bad]);
      api().clearRejectedFiles();
      await check([good], []);
      api().setFiles([good, bad]);
      await check([good], [bad]);
      api().clearFiles();
      await check([], []);
      api().resetFiles([fixed]);
      await check([fixed], []);
      api().deleteFile(fixed);
      await check([], []);
      api().clearFiles();
      await Promise.resolve();
      await Promise.resolve();
      expect(changes).toHaveLength(0);
    } finally {
      machine.stop();
    }
  });
});
