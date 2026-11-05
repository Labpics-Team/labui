import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { packedConsumer } from './packed-consumer.js';

const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const react = resolve(core, '../react');
const tsc = createRequire(import.meta.url).resolve('typescript/lib/tsc.js');
let temporary: string;
let consumer: string;

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'labui-packed-types-'));
  const packed = await packedConsumer(temporary, {
    '@labpics/ui-core': { directory: core, archive: process.env.LABUI_CORE_TARBALL },
    '@labpics/ui-shadow': {
      directory: resolve(core, '../shadow'),
      archive: process.env.LABUI_SHADOW_TARBALL,
    },
    '@labpics/ui-react': { directory: react, archive: process.env.LABUI_REACT_TARBALL },
  });
  consumer = packed.directory;
  // Обычный TS-потребитель React устанавливает его типы; используем тот же lockfile.
  for (const name of ['react', 'react-dom']) {
    const destination = join(consumer, 'node_modules/@types', name);
    await mkdir(dirname(destination), { recursive: true });
    await symlink(
      await realpath(join(react, 'node_modules/@types', name)),
      destination,
      'junction',
    );
  }
}, 60_000);

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

const consumers = [
  {
    name: 'core-root',
    source: `
import { LabElement, ZagController, litVar, type LabInputSize } from '@labpics/ui-core';
const size: LabInputSize = 'm';
void [LabElement, ZagController, litVar, size];
`,
  },
  {
    name: 'core-component',
    source: `
import { LabCombobox, filterComboboxItems, type LabComboboxItem } from '@labpics/ui-core/combobox';
const items: LabComboboxItem[] = [{value:'a',label:'Alpha'}];
filterComboboxItems(items, 'a');
void LabCombobox;
`,
  },
  {
    name: 'core-sheet',
    source: `
import { LabSheet, type LabSheetPosition, type SheetPositionChangeDetails, type SheetMotionErrorDetails } from '@labpics/ui-core/sheet';
const sheet: LabSheet = document.createElement('lab-sheet');
const position: LabSheetPosition = 'two-thirds';
sheet.open = true;
sheet.position = position;
sheet.modal = 'false';
const updated: Promise<boolean> = sheet.updateComplete;
const construct: { new(): HTMLElement } = LabSheet;
const changed: SheetPositionChangeDetails = { position };
const failed: SheetMotionErrorDetails = { error: new Error('Движение отменено') };
// @ts-expect-error Позиции ограничены публичным контрактом.
sheet.position = 'three-fourths';
// @ts-expect-error Sheet не наследует размер Dialog.
sheet.size = 'm';
void [LabSheet, changed, failed, updated, construct];
`,
  },
  {
    name: 'shared',
    source: `
import { cssVar, filterComboboxItems, type LabComboboxItem } from '@labpics/ui-core/shared';
const items: LabComboboxItem[] = [{value:'a',label:'Alpha'}];
cssVar('--lab-label-primary');
filterComboboxItems(items, 'a');
`,
  },
  {
    name: 'dialog-behavior',
    source: `
import * as dialog from '@labpics/ui-core/behaviors/dialog';
import type { MachineModule, SchemaOf } from '@labpics/ui-core';
type DialogSchema = SchemaOf<dialog.Service>;
const module: MachineModule<DialogSchema, dialog.Api> = dialog;
const props: dialog.Props = { id: 'consumer-dialog', triggerEl: () => document.createElement('button') };
// @ts-expect-error Ссылка на trigger не принимает произвольное значение.
const invalid: dialog.Props = { id: 'consumer-dialog', triggerEl: 'trigger' };
void [module, props, invalid];
`,
  },
  {
    name: 'react-root',
    source: `
import { Input, type InputProps } from '@labpics/ui-react';
const props: InputProps = {label:'Name',size:'m'};
void [Input, props];
`,
  },
  {
    name: 'react-component',
    source: `
import { Input, type InputProps } from '@labpics/ui-react/input';
const props: InputProps = {label:'Name',size:'m'};
void [Input, props];
`,
  },
  {
    name: 'react-dialog',
    source: `
import { Dialog, type DialogProps } from '@labpics/ui-react/dialog';
import { AlertDialog, type AlertDialogProps } from '@labpics/ui-react/alert-dialog';
const dialog: DialogProps = { heading: 'Параметры', content: 'Действие' };
const alert: AlertDialogProps = { heading: 'Подтверждение', content: 'Действие' };
// @ts-expect-error Потребитель компонента не управляет внутренним DOM binding.
const invalid: DialogProps = { triggerEl: () => document.createElement('button') };
void [Dialog, AlertDialog, dialog, alert, invalid];
`,
  },
];

describe('публичный tarball: декларации соответствуют формату потребителя', () => {
  for (const extension of ['mts', 'cts']) {
    it.each(consumers)(
      `${extension}: $name компилируется в NodeNext`,
      async ({ name, source }) => {
        const file = join(consumer, `${name}.${extension}`);
        await writeFile(file, source);
        // Без workspace paths и без сравнения классов между форматами.
        // Один и тот же обычный import в .cts становится require, в .mts — ESM.
        const result = spawnSync(
          process.execPath,
          [
            tsc,
            '--noEmit',
            '--strict',
            '--target',
            'es2022',
            '--lib',
            'es2022,dom,dom.iterable',
            '--esModuleInterop',
            // Sheet проверяет также весь граф публичных деклараций.
            ...(name === 'core-sheet' ? [] : ['--skipLibCheck']),
            '--module',
            'nodenext',
            '--moduleResolution',
            'nodenext',
            file,
          ],
          { cwd: consumer, encoding: 'utf8', timeout: 20_000, windowsHide: true },
        );
        expect(result.error, result.stderr).toBeUndefined();
        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      },
      25_000,
    );
  }
});
