import { Button } from '@labpics/ui-react/button';
import { Card } from '@labpics/ui-react/card';
import { Input } from '@labpics/ui-react/input';
import { Sheet } from '@labpics/ui-react/sheet';
import { Snackbar } from '@labpics/ui-react/snackbar';
import { Switch } from '@labpics/ui-react/switch';
import { Textarea } from '@labpics/ui-react/textarea';
import { type ThemeScope, createThemeScope, initializeColors } from '@labui/colors/runtime';
import { type FormEvent, type MouseEvent, StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  type WorkspaceChange,
  type WorkspaceRecord,
  defaultWorkspace,
  readWorkspace,
  saveWorkspace,
  undoWorkspace,
} from './workspace-store.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Workspace() {
  const [record, setRecord] = useState<WorkspaceRecord | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [draft, setDraft] = useState(defaultWorkspace);
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const pending = useRef(false);
  const restoreTriggerFocus = useRef(false);
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState<{
    key: number;
    message: string;
    undo?: WorkspaceChange;
  } | null>(null);
  const noticeKey = useRef(0);
  const [dark, setDark] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const scope = useRef<ThemeScope>();
  const mounted = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the retry counter starts a new storage read.
  useEffect(() => {
    let disposed = false;
    setLoadError(false);
    void readWorkspace().then(
      (next) => {
        if (!disposed) setRecord(next);
      },
      () => {
        if (!disposed) setLoadError(true);
      },
    );
    return () => {
      disposed = true;
    };
  }, [loadAttempt]);
  useEffect(() => {
    let disposed = false;
    void initializeColors()
      .then(() => {
        if (disposed) return;
        scope.current = createThemeScope(document.documentElement);
        setThemeReady(true);
      })
      .catch(() => {
        if (!disposed)
          setStatus('Доступна начальная тема. Не удалось загрузить настройку контраста.');
      });
    return () => {
      disposed = true;
      scope.current?.dispose();
      scope.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (!themeReady) return;
    const result = scope.current?.update({
      theme: dark ? 'dark' : 'light',
      contrast: contrast ? 'more' : 'normal',
    });
    if (result && !result.ok) setStatus('Не удалось изменить тему. Предыдущая палитра сохранена.');
  }, [dark, contrast, themeReady]);

  function changeOpen(next: boolean) {
    if (pending.current) return;
    if (next) {
      if (!record) return;
      setDraft(record.workspace);
      setInvalid(false);
      setEmailInvalid(false);
      setSaveError(false);
      setNotice(null);
    }
    setOpen(next);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const nameError = !draft.name.trim();
    const emailError =
      (draft.notifications || !!draft.email.trim()) && !emailPattern.test(draft.email.trim());
    setInvalid(nameError);
    setEmailInvalid(emailError);
    if (nameError || emailError) {
      (nameError ? nameInput : emailInput).current?.focus();
      return;
    }
    pending.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      const change = await saveWorkspace(draft);
      if (!mounted.current) return;
      setRecord(change.after);
      setOpen(false);
      setNotice({ key: ++noticeKey.current, message: 'Настройки сохранены', undo: change });
    } catch {
      if (mounted.current) setSaveError(true);
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  // The button becomes focusable again after a failed commit; keep retry at the same place.
  useEffect(() => {
    if (saveError && !saving) saveButton.current?.focus();
  }, [saveError, saving]);

  useEffect(() => {
    if (!undoing && restoreTriggerFocus.current) {
      restoreTriggerFocus.current = false;
      settingsTrigger.current?.focus({ preventScroll: true });
    }
  }, [undoing]);

  async function undo(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!notice?.undo || pending.current) return;
    pending.current = true;
    setUndoing(true);
    try {
      const restored = await undoWorkspace(notice.undo);
      const current = restored ?? (await readWorkspace());
      if (!mounted.current) return;
      setRecord(current);
      setNotice({
        key: ++noticeKey.current,
        message: restored ? 'Изменения отменены' : 'Настройки уже изменились',
      });
      restoreTriggerFocus.current = true;
    } catch {
      if (mounted.current) {
        const key = ++noticeKey.current;
        setNotice((current) =>
          current
            ? {
                ...current,
                key,
                message: 'Не удалось отменить. Попробуйте ещё раз.',
              }
            : null,
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setUndoing(false);
    }
  }

  const settings = record?.workspace;
  return (
    <div className="workspace">
      <header className="workspace-topbar">
        <a className="workspace-brand" href="./index.html">
          LabUI
        </a>
        <span className="workspace-caption">Пример приложения</span>
      </header>
      <main className="workspace-main">
        <h1>Настройки</h1>
        <Card
          className="workspace-card"
          padding="l"
          caption="Рабочее пространство"
          heading={settings?.name ?? 'Пространство'}
          description={settings?.description}
          footer={
            settings && (
              <Sheet
                open={open}
                onOpenChange={changeOpen}
                defaultPosition="flex"
                heading="Настройки пространства"
                onMotionError={() => setStatus('Не удалось открыть панель. Попробуйте ещё раз.')}
                trigger={({ props, ref }) => (
                  <Button
                    {...props}
                    className="workspace-edit"
                    ref={(element) => {
                      ref(element);
                      settingsTrigger.current = element;
                    }}
                    disabled={undoing}
                  >
                    Изменить настройки
                  </Button>
                )}
                content={
                  <form className="workspace-form" onSubmit={save} noValidate aria-busy={saving}>
                    <Input
                      ref={nameInput}
                      label="Название пространства"
                      name="workspace-name"
                      value={draft.name}
                      maxLength={80}
                      autoComplete="organization"
                      required
                      readOnly={saving}
                      invalid={invalid}
                      error="Введите название пространства"
                      onValueChange={(name) => {
                        setDraft((value) => ({ ...value, name }));
                        if (name.trim()) setInvalid(false);
                      }}
                    />
                    <Textarea
                      label="Описание"
                      name="workspace-description"
                      value={draft.description}
                      maxLength={320}
                      rows={3}
                      readOnly={saving}
                      onValueChange={(description) =>
                        setDraft((value) => ({ ...value, description }))
                      }
                    />
                    <Input
                      ref={emailInput}
                      label="Почта для уведомлений"
                      name="workspace-email"
                      inputType="email"
                      autoComplete="email"
                      value={draft.email}
                      maxLength={254}
                      required={draft.notifications}
                      readOnly={saving}
                      invalid={emailInvalid}
                      error="Проверьте адрес почты"
                      onValueChange={(email) => {
                        setDraft((value) => ({ ...value, email }));
                        setEmailInvalid(false);
                      }}
                    />
                    <div className="workspace-option">
                      <Switch
                        labelStart="Уведомления команды"
                        checked={draft.notifications}
                        disabled={saving}
                        onCheckedChange={(notifications) =>
                          setDraft((value) => ({ ...value, notifications }))
                        }
                      />
                      <p>Изменения проектов и важные сообщения.</p>
                    </div>
                    {saveError && (
                      <p className="workspace-error" role="alert">
                        Не удалось сохранить изменения. Попробуйте ещё раз.
                      </p>
                    )}
                    <div className="workspace-actions">
                      <Button
                        type="neutral"
                        kind="tinted"
                        disabled={saving}
                        onClick={() => changeOpen(false)}
                      >
                        Отмена
                      </Button>
                      <Button ref={saveButton} htmlType="submit" loading={saving}>
                        Сохранить
                      </Button>
                    </div>
                  </form>
                }
              />
            )
          }
        >
          {settings ? (
            <dl className="workspace-details">
              <div>
                <dt>Почта для уведомлений</dt>
                <dd>{settings.email || 'Не указана'}</dd>
              </div>
              <div>
                <dt>Уведомления команды</dt>
                <dd>{settings.notifications ? 'Включены' : 'Выключены'}</dd>
              </div>
            </dl>
          ) : loadError ? (
            <div className="workspace-load-error">
              <p role="alert">Не удалось прочитать настройки.</p>
              <Button size="s" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                Повторить
              </Button>
            </div>
          ) : (
            <p className="workspace-loading">Загружаем настройки…</p>
          )}
        </Card>
        <Card className="workspace-card" padding="l" heading="Внешний вид">
          <div className="workspace-preferences">
            <div className="workspace-option">
              <Switch
                labelStart="Тёмная тема"
                checked={dark}
                disabled={!themeReady}
                onCheckedChange={setDark}
              />
            </div>
            <div className="workspace-option">
              <Switch
                labelStart="Повышенный контраст"
                checked={contrast}
                disabled={!themeReady}
                onCheckedChange={setContrast}
              />
              <p>Более отчётливые подписи и границы.</p>
            </div>
          </div>
        </Card>
        {status && <output className="workspace-status">{status}</output>}
        <p className="workspace-local-note">Параметры пространства сохраняются в этом браузере.</p>
      </main>
      <Snackbar
        className="workspace-snackbar"
        open={notice !== null}
        message={notice?.message ?? ''}
        notificationKey={notice?.key}
        duration={undoing ? 0 : undefined}
        aria-busy={undoing || undefined}
        actionLabel={notice?.undo ? 'Отменить' : undefined}
        onAction={undo}
        onRuntimeError={(error) => reportError(error)}
        onOpenChange={(next) => {
          if (!next && !pending.current) setNotice(null);
        }}
      />
    </div>
  );
}

const root = document.querySelector('#experience-root');
if (!root) throw new Error('Missing experience mount');
createRoot(root).render(
  <StrictMode>
    <Workspace />
  </StrictMode>,
);
