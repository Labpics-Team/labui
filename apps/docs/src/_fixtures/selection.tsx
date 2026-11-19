import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@labpics/ui-core/checkbox';
import '@labpics/ui-core/radio-group';
import '@labpics/ui-core/choicebox';
import '@labpics/ui-core/selection-controls.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-tokens/tokens.css';
import '@labpics/fonts/fonts.css';
import '../theme-switch.js';
import { Checkbox } from '@labpics/ui-react/checkbox';
import { Choicebox } from '@labpics/ui-react/choicebox';
import { Radio, RadioGroup } from '@labpics/ui-react/radio-group';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '@labui/colors/contract.css';

const node = document.getElementById('react');
if (!node) throw new Error('Missing React fixture');
createRoot(node).render(
  <StrictMode>
    <form data-testid="react-form">
      <Checkbox name="check" value="yes" required defaultChecked>
        Условия
      </Checkbox>
      <Checkbox name="mixed" defaultChecked="indeterminate">
        Часть
      </Checkbox>
      <RadioGroup label="Доставка" name="radio" required defaultValue="a">
        <Radio value="a">Обычная</Radio>
        <Radio value="b" disabled>
          Недоступная
        </Radio>
        <Radio value="c">Срочная</Radio>
      </RadioGroup>
      <Choicebox
        label="План"
        name="single"
        required
        defaultValue={['a']}
        items={[
          { value: 'a', label: 'Личный' },
          { value: 'b', label: 'Командный' },
        ]}
      />
      <Choicebox
        label="Дополнения"
        name="multi"
        required
        multiple
        defaultValue={['a']}
        items={[
          { value: 'a', label: 'История' },
          { value: 'b', label: 'Архив' },
        ]}
      />
      <fieldset disabled>
        <Checkbox name="blocked" checked>
          Недоступно
        </Checkbox>
      </fieldset>
      <button type="reset">Сбросить</button>
    </form>
    <div data-testid="react-controlled">
      <Checkbox checked>Закреплённый</Checkbox>
    </div>
    <div data-testid="react-controlled-radio">
      <RadioGroup value="a">
        <Radio value="a">Первый</Radio>
        <Radio value="b">Второй</Radio>
      </RadioGroup>
    </div>
    <div className="long" data-testid="react-long">
      <Checkbox size="l" labelStart="Включить">
        Отправлять уведомления о завершении обработки фотографий автоматически
      </Checkbox>
    </div>
    <div className="long" data-testid="react-rich">
      <Choicebox
        layout="row"
        defaultValue={['a']}
        items={[
          {
            value: 'a',
            label: <strong>Совместная обработка изображений</strong>,
            description: 'Доступ участников рабочего пространства к исходным материалам',
            icon: (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13 1 4 14h7l-1 9 10-14h-7z" />
              </svg>
            ),
          },
        ]}
      />
    </div>
  </StrictMode>,
);
const hydrated = document.getElementById('react-hydrate');
if (hydrated)
  hydrateRoot(
    hydrated,
    <Checkbox name="ssr" defaultChecked>
      Серверный выбор
    </Checkbox>,
  );
const matrix = document.getElementById('matrix');
for (const kind of ['checkbox', 'radio-group'] as const)
  for (const type of ['accent', 'neutral'])
    for (const size of ['tiny', 's', 'm', 'l']) {
      const cell = document.createElement('div');
      const element = document.createElement(`lab-${kind}`);
      element.setAttribute('type', type);
      element.setAttribute('size', size);
      if (kind === 'checkbox') {
        element.setAttribute('checked', '');
        element.innerHTML = '<span slot="label-start">Label</span>Label';
      } else {
        element.setAttribute('value', 'on');
        element.setAttribute('items', JSON.stringify([{ value: 'on', label: 'Label' }]));
      }
      cell.dataset.specimen = `${kind}-${type}-${size}`;
      cell.append(element);
      matrix?.append(cell);
    }
