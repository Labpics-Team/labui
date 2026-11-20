import '../foundation.css';
import '@labpics/ui-core/combobox';
import '@labpics/ui-core/number-input';
import '@labpics/ui-core/tags-input';
import { Combobox, type ComboboxProps } from '@labpics/ui-react/combobox';
import { NumberInput, type NumberInputProps } from '@labpics/ui-react/number-input';
import { TagsInput, type TagsInputProps } from '@labpics/ui-react/tags-input';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
const items = [
  { value: 'a', label: 'Архитектура' },
  { value: 'b', label: 'Брендинг' },
  { value: 'c', label: 'Графический дизайн', disabled: true },
  { value: 'd', label: 'Разработка' },
];
const form = document.querySelector<HTMLFormElement>('#lit');
if (!form) throw new Error('Missing Lit form fixture');
const combo = document.createElement('lab-combobox');
Object.assign(combo, { label: 'Специализация', name: 'specialty', items, defaultValue: ['a'] });
form.append(combo);
const number = document.createElement('lab-number-input');
Object.assign(number, {
  label: 'Количество',
  name: 'quantity',
  defaultValue: '2',
  min: 0,
  max: 10,
  step: 0.1,
});
form.append(number);
const tags = document.createElement('lab-tags-input');
Object.assign(tags, {
  label: 'Направления',
  name: 'tags',
  defaultValue: ['Дизайн', 'Системы'],
  placeholder: 'Добавить…',
  addOnPaste: true,
});
form.append(tags);
const reset = document.createElement('button');
reset.type = 'reset';
reset.textContent = 'Сбросить';
form.append(reset);
type FixtureState = {
  combobox?: Partial<ComboboxProps>;
  number?: Partial<NumberInputProps>;
  tags?: Partial<TagsInputProps>;
};
let updateReact: (state: FixtureState) => void;
function App() {
  const [state, setState] = useState<FixtureState>({});
  updateReact = setState;
  return (
    <form id="react-form">
      <h2>React</h2>
      <Combobox
        label="Специализация"
        name="specialty"
        items={items}
        defaultValue={['a']}
        {...state.combobox}
      />
      <NumberInput
        label="Количество"
        name="quantity"
        defaultValue="2"
        min={0}
        max={10}
        step={0.1}
        {...state.number}
      />
      <TagsInput
        label="Направления"
        name="tags"
        defaultValue={['Дизайн', 'Системы']}
        placeholder="Добавить…"
        addOnPaste
        {...state.tags}
      />
      <button type="reset">Сбросить</button>
    </form>
  );
}
const reactRoot = document.querySelector('#react');
if (!reactRoot) throw new Error('Missing React fixture');
createRoot(reactRoot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
Object.assign(window, {
  inputExtensions: {
    combo,
    number,
    tags,
    updateReact: (state: FixtureState) => updateReact(state),
  },
});

declare global {
  interface Window {
    inputExtensions: {
      combo: typeof combo;
      number: typeof number;
      tags: typeof tags;
      updateReact(state: FixtureState): void;
    };
    inputExtensionRequests: (string | string[])[];
  }
}
