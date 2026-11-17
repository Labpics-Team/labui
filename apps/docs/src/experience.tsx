import { Button } from '@labpics/ui-react/button';
import { Card } from '@labpics/ui-react/card';
import { Input } from '@labpics/ui-react/input';
import { Sheet } from '@labpics/ui-react/sheet';
import { Snackbar } from '@labpics/ui-react/snackbar';
import { Switch } from '@labpics/ui-react/switch';
import { type ThemeScope, createThemeScope, initializeColors } from '@labui/colors/runtime';
import { type FormEvent, type MouseEvent, StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface Settings {
  name: string;
  notifications: boolean;
}
const storageKey = 'labui.workspace.v1';
const defaults: Settings = { name: 'Labpics', notifications: true };

function readSettings(): Settings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (
      saved &&
      typeof saved === 'object' &&
      'name' in saved &&
      'notifications' in saved &&
      typeof saved.name === 'string' &&
      saved.name.trim() &&
      typeof saved.notifications === 'boolean'
    ) {
      return { name: saved.name, notifications: saved.notifications };
    }
  } catch {
    /* Недоступное хранилище сохраняет работоспособность формы. */
  }
  return { ...defaults };
}

function Workspace() {
  const [settings, setSettings] = useState(readSettings);
  const [draft, setDraft] = useState(settings);
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState<{ key: number; message: string; undo?: Settings } | null>(
    null,
  );
  const noticeKey = useRef(0);
  const [dark, setDark] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const scope = useRef<ThemeScope>();
  const nameInput = useRef<HTMLInputElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let disposed = false;
    void initializeColors()
      .then(() => {
        if (disposed) return;
        scope.current = createThemeScope(document.documentElement);
        setThemeReady(true);
      })
      .catch(() => setStatus('Доступна начальная тема. Не удалось загрузить настройку контраста.'));
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
    if (next) {
      setDraft(settings);
      setInvalid(false);
      setStatus('');
    }
    setOpen(next);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setInvalid(true);
      nameInput.current?.focus();
      return;
    }
    const next = { ...draft, name: draft.name.trim() };
    let persisted = true;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      persisted = false;
    }
    setSettings(next);
    setOpen(false);
    setStatus(persisted ? '' : 'Настройки применены до закрытия страницы: хранилище недоступно.');
    setNotice({
      key: ++noticeKey.current,
      message: persisted ? 'Настройки сохранены' : 'Изменения применены',
      undo: settings,
    });
  }

  function undo(event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    if (!notice?.undo) return;
    const previous = notice.undo;
    try {
      localStorage.setItem(storageKey, JSON.stringify(previous));
      setStatus('');
    } catch {
      setStatus('Отмена применена до закрытия страницы: хранилище недоступно.');
    }
    setSettings(previous);
    setNotice({ key: ++noticeKey.current, message: 'Изменения отменены' });
    settingsTrigger.current?.focus({ preventScroll: true });
  }

  return (
    <div className="workspace">
      <header className="workspace-topbar">
        <a className="workspace-brand" href="./index.html">
          labpics<span>LabUI</span>
        </a>
        <span className="workspace-caption">Рабочее пространство</span>
      </header>
      <main className="workspace-main">
        <div className="workspace-intro">
          <h1>Пространство</h1>
        </div>
        <Card
          className="workspace-card"
          variant="outlined"
          padding="l"
          header={
            <div className="workspace-card-heading">
              <span className="workspace-monogram" aria-hidden="true">
                {settings.name.slice(0, 1).toLocaleUpperCase()}
              </span>
              <div>
                <h2>{settings.name}</h2>
              </div>
            </div>
          }
          footer={
            <Sheet
              open={open}
              onOpenChange={changeOpen}
              defaultPosition="half"
              heading="Настройки пространства"
              onMotionError={() => setStatus('Не удалось открыть панель. Попробуйте ещё раз.')}
              trigger={({ props, ref }) => (
                <Button
                  {...props}
                  ref={(element) => {
                    ref(element);
                    settingsTrigger.current = element;
                  }}
                  type="neutral"
                  kind="tinted"
                >
                  Изменить настройки
                </Button>
              )}
              content={
                <form className="workspace-form" onSubmit={save} noValidate>
                  <Input
                    ref={nameInput}
                    label="Название пространства"
                    name="workspace-name"
                    value={draft.name}
                    maxLength={80}
                    autoComplete="organization"
                    invalid={invalid}
                    error="Введите название пространства"
                    onValueChange={(name) => {
                      setDraft((value) => ({ ...value, name }));
                      if (name.trim()) setInvalid(false);
                    }}
                  />
                  <div className="workspace-option">
                    <Switch
                      checked={draft.notifications}
                      onCheckedChange={(notifications) =>
                        setDraft((value) => ({ ...value, notifications }))
                      }
                    >
                      Уведомления команды
                    </Switch>
                    <p>Изменения проектов и важные сообщения.</p>
                  </div>
                  <div className="workspace-actions">
                    <Button type="neutral" kind="tinted" onClick={() => setOpen(false)}>
                      Отмена
                    </Button>
                    <Button htmlType="submit">Сохранить</Button>
                  </div>
                </form>
              }
            />
          }
        >
          <dl className="workspace-details">
            <div>
              <dt>Уведомления команды</dt>
              <dd>{settings.notifications ? 'Включены' : 'Выключены'}</dd>
            </div>
          </dl>
        </Card>
        <Card
          className="workspace-card"
          variant="outlined"
          padding="l"
          header={<h2>Оформление</h2>}
        >
          <div className="workspace-preferences">
            <div className="workspace-option">
              <Switch checked={dark} disabled={!themeReady} onCheckedChange={setDark}>
                Тёмная тема
              </Switch>
            </div>
            <div className="workspace-option">
              <Switch checked={contrast} disabled={!themeReady} onCheckedChange={setContrast}>
                Повышенный контраст
              </Switch>
              <p>Более отчётливые подписи и границы.</p>
            </div>
          </div>
        </Card>
        {status && <output className="workspace-status">{status}</output>}
      </main>
      <Snackbar
        className="workspace-snackbar"
        open={notice !== null}
        message={notice?.message ?? ''}
        notificationKey={notice?.key}
        actionLabel={notice?.undo ? 'Отменить' : undefined}
        onAction={undo}
        onOpenChange={(next) => {
          if (!next) setNotice(null);
        }}
      />
      <footer className="workspace-footer">LabUI</footer>
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
