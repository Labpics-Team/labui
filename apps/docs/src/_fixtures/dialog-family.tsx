import '../foundation.css';
import '@labpics/ui-core/dialog';
import '@labpics/ui-core/alert-dialog';
import '@labpics/ui-core/popover';
import { AlertDialog } from '@labpics/ui-react/alert-dialog';
import { Button } from '@labpics/ui-react/button';
import { Dialog } from '@labpics/ui-react/dialog';
import { Popover } from '@labpics/ui-react/popover';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

function Example() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState('Draft');
  return (
    <>
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        heading="Are you absolutely sure?"
        description="This action cannot be undone. This will permanently delete your account and remove your data from our servers."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        pending={pending}
        onConfirm={() => setPending(true)}
        trigger={({ props, ref }) => (
          <Button {...props} ref={ref} type="neutral">
            React alert
          </Button>
        )}
      />
      <Dialog
        heading="Настройки"
        description="Изменения сохранятся после подтверждения."
        trigger={({ props, ref }) => (
          <Button {...props} ref={ref}>
            React dialog
          </Button>
        )}
        content={
          <>
            <label>
              Название{' '}
              <input
                aria-label="React dialog draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <Popover
              heading="Дополнительно"
              content={<input aria-label="React nested draft" defaultValue="Nested" />}
              trigger={({ props, ref }) => (
                <Button {...props} ref={ref}>
                  React nested popover
                </Button>
              )}
            />
          </>
        }
        actions={({ close }) => <Button onClick={close}>Сохранить</Button>}
      />
      <Popover
        heading="Дополнительные настройки"
        closable
        content={<input aria-label="React popover draft" defaultValue="Popover" />}
        trigger={({ props, ref }) => (
          <Button {...props} ref={ref}>
            React popover
          </Button>
        )}
      />
    </>
  );
}
const reactRoot = document.getElementById('react');
const saveLit = document.getElementById('save-lit');
const litDialog = document.getElementById('lit-dialog') as (HTMLElement & { open: boolean }) | null;
const litAlert = document.getElementById('lit-alert') as
  | (HTMLElement & { pending: boolean })
  | null;
if (!reactRoot || !saveLit || !litDialog || !litAlert)
  throw new Error('Missing dialog family fixture nodes');
createRoot(reactRoot).render(
  <StrictMode>
    <Example />
  </StrictMode>,
);
saveLit.addEventListener('click', () => {
  litDialog.open = false;
});
litAlert.addEventListener('confirm', () => {
  litAlert.pending = true;
});
