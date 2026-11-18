import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@labpics/fonts/fonts.css';
import '@labui/colors/contract.css';
import '../theme-switch.js';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/tokens.css';
import '@labpics/ui-core/loader';
import '@labpics/ui-core/progress';
import { Loader } from '@labpics/ui-react/loader';
import { Progress } from '@labpics/ui-react/progress';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
function App() {
  const [value, setValue] = useState<number | null>(25);
  const [variant, setVariant] = useState<'linear' | 'circular'>('circular');
  const change = (next: number | null) => {
    setValue(next);
    const progress = document.querySelector<HTMLElementTagNameMap['lab-progress']>(
      'lab-progress[data-testid="lit-change"]',
    );
    const loader = document.querySelector<HTMLElementTagNameMap['lab-loader']>(
      'lab-loader[data-testid="lit-loader-change"]',
    );
    if (progress) progress.value = next;
    if (loader) loader.value = next;
  };
  const shape = () => {
    const next = variant === 'linear' ? 'circular' : 'linear';
    setVariant(next);
    const progress = document.querySelector<HTMLElementTagNameMap['lab-progress']>(
      'lab-progress[data-testid="lit-change"]',
    );
    if (progress) progress.variant = next;
  };
  return (
    <>
      <div id="react-masters">
        <h2>Loader · React</h2>
        <div className="line loaders">
          <Loader />
          <Loader size="l" />
          <Loader value={75} />
          <Loader value={75} size="l" />
        </div>
        <h2>Linear · React</h2>
        <div className="linear">
          {[0, 25, 50, 75, 100].map((value) => (
            <Progress key={value} value={value} />
          ))}
        </div>
        <h2>Circular · React</h2>
        <div className="circles">
          {[false, true].flatMap((showValueText) =>
            [0, 25, 50, 75, 100].map((value) => (
              <Progress
                key={`${showValueText}-${value}`}
                value={value}
                variant="circular"
                showValueText={showValueText}
              />
            )),
          )}
        </div>
      </div>
      <div className="line">
        <Progress
          data-testid="react-change"
          value={value}
          variant={variant}
          label="Изменение"
          showValueText
        />
        <Loader data-testid="react-loader-change" value={value} label="Изменение загрузки" />
      </div>
      <div className="line">
        <button type="button" onClick={() => change(75)}>
          75%
        </button>
        <button type="button" onClick={() => change(null)}>
          Неизвестно
        </button>
        <button type="button" onClick={() => change(0)}>
          0%
        </button>
        <button type="button" onClick={shape}>
          Сменить форму
        </button>
      </div>
    </>
  );
}
const root = document.getElementById('react');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
