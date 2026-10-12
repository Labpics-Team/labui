import '@labpics/ui-core/dialog';
import '@labpics/ui-core/alert-dialog';
import { AlertDialog } from '@labpics/ui-react/alert-dialog';
import { Combobox } from '@labpics/ui-react/combobox';
import { Dialog } from '@labpics/ui-react/dialog';
import { Menu } from '@labpics/ui-react/menu';
import { Popover } from '@labpics/ui-react/popover';
import { Select } from '@labpics/ui-react/select';
import { Tooltip } from '@labpics/ui-react/tooltip';
import colourContract from '@labui/colors/contract.css?inline';
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '../styles.css';

const items = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
];
const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing portal scope fixture mount');
const root = createRoot(mount);

root.render(
  <StrictMode>
    <span data-surface="tooltip">
      <Tooltip openDelay={0} content={<span data-testid="react-tooltip-content">Hint</span>}>
        Tooltip
      </Tooltip>
    </span>
    <span data-surface="popover">
      <Popover content={<span data-testid="react-popover-content">Details</span>}>Popover</Popover>
    </span>
    <span data-surface="menu">
      <Menu items={items} label="Menu" />
    </span>
    <span data-surface="select">
      <Select items={items} label="Select" />
    </span>
    <span data-surface="combobox">
      <Combobox items={items} label="Combobox" />
    </span>
    <span data-surface="dialog">
      <Dialog
        heading="React dialog"
        content={
          <button type="button" data-testid="react-dialog-content">
            Action
          </button>
        }
      >
        Dialog
      </Dialog>
    </span>
    <span data-surface="alert">
      <AlertDialog
        heading="React alert"
        content={
          <button type="button" data-testid="react-alert-content">
            Confirm
          </button>
        }
      >
        Alert
      </AlertDialog>
    </span>
  </StrictMode>,
);

// Только браузерный стенд владеет этой командой завершения реальных consumers.
Object.assign(window, {
  async mountUnassignedDialog() {
    const origin = document.createElement('div');
    origin.id = 'slot-origin';
    const shadow = origin.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = colourContract;
    shadow.append(style);
    const dialog = document.createElement('lab-dialog');
    dialog.dataset.testid = 'slotted-dialog';
    dialog.setAttribute('heading', 'Slotted dialog');
    dialog.textContent = 'Open slotted dialog';
    const input = document.createElement('input');
    input.slot = 'content';
    input.dataset.testid = 'slotted-dialog-content';
    input.setAttribute('aria-label', 'Slotted input');
    dialog.append(input);
    origin.append(dialog);
    document.querySelector('#scope')?.append(origin);
    await Reflect.get(dialog, 'updateComplete');
    // Исчерпать первоначальные body insertions до назначения slot: они не должны маскировать gap.
    await new Promise<void>((resolve) => requestAnimationFrame(() => queueMicrotask(resolve)));
    Object.assign(window, {
      slottedScopeNodes: {
        dialog,
        trigger: dialog.shadowRoot?.querySelector('.trigger'),
        input,
        portal: document.querySelector('[data-portal-for="slotted-dialog"]'),
      },
    });
  },
  unmountPortalScopes() {
    flushSync(() => root.unmount());
    document
      .querySelectorAll('lab-dialog, lab-alert-dialog')
      .forEach((element) => element.remove());
  },
});
