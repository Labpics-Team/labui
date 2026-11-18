import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@labpics/fonts/fonts.css';
import '@labui/colors/contract.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/tokens.css';
import '@labpics/ui-core/chip';
import '@labpics/ui-core/chip.css';
import { Chip } from '@labpics/ui-react/chip';
import { StrictMode, useState } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

const states = ['default', 'hover', 'pressed', 'focus', 'active', 'disabled', 'loading'];
const variants = [false, true].flatMap((sharp) =>
  (['s', 'm'] as const).flatMap((size) =>
    [false, true].flatMap((selected) => states.map((state) => ({ sharp, size, selected, state }))),
  ),
);
const pose = (button: Element | null, state: string) => {
  const attr = { hover: 'data-hovered', pressed: 'data-pressed', focus: 'data-focused' }[state];
  if (attr) button?.setAttribute(attr, '');
};
const lit = document.querySelector('#lit-matrix');
for (const [index, variant] of variants.entries()) {
  const cell = document.createElement('div');
  cell.dataset.variant = String(index);
  const chip = document.createElement('lab-chip');
  Object.assign(chip, variant, {
    active: variant.state === 'active',
    disabled: variant.state === 'disabled',
    loading: variant.state === 'loading',
  });
  chip.textContent = 'Chip label';
  cell.append(chip);
  lit?.append(cell);
  void chip.updateComplete.then(() =>
    pose(chip.shadowRoot?.querySelector('button') ?? null, variant.state),
  );
}
const matrix = document.querySelector('#react-matrix');
if (matrix)
  createRoot(matrix).render(
    variants.map((v, index) => (
      <div
        key={`${v.sharp}-${v.size}-${v.selected}-${v.state}`}
        data-variant={index}
        ref={(node) => pose(node?.querySelector('button') ?? null, v.state)}
      >
        <Chip
          size={v.size}
          sharp={v.sharp}
          selected={v.selected}
          active={v.state === 'active'}
          disabled={v.state === 'disabled'}
          loading={v.state === 'loading'}
        >
          Chip label
        </Chip>
      </div>
    )),
  );

function Scenarios() {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState(0);
  return (
    <>
      <form id="react-form">
        <Chip name="filter" value="design" defaultSelected>
          Дизайн
        </Chip>
        <Chip selected onSelectedChange={() => setRequests((n) => n + 1)}>
          Согласованный
        </Chip>
        <button type="reset">Сбросить</button>
        <output>{requests}</output>
      </form>
      <div id="react-pending" className="line">
        <Chip selected loading={loading} onSelectedChange={() => setLoading(true)}>
          Подтверждение фильтра
        </Chip>
        <button type="button" onClick={() => setLoading(false)}>
          Завершить
        </button>
      </div>
      <div id="react-actions" className="line">
        <Chip mode="action" onAction={() => setRequests((n) => n + 1)}>
          Применить
        </Chip>
        <Chip mode="remove" aria-label="Удалить Дизайн" onRemove={() => setRequests((n) => n + 1)}>
          Дизайн
        </Chip>
        <Chip disabled>Недоступен</Chip>
      </div>
    </>
  );
}
const scenarios = document.querySelector('#react-scenarios');
if (scenarios)
  createRoot(scenarios).render(
    <StrictMode>
      <Scenarios />
    </StrictMode>,
  );
const ssr = document.querySelector('#ssr-react');
if (ssr)
  hydrateRoot(
    ssr,
    <Chip defaultSelected active showLeading leading={<span>●</span>}>
      SSR filter
    </Chip>,
  );
