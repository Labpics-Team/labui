import '@labpics/fonts/fonts.css';
import '@labui/colors/contract.css';
import '@labpics/ui-core/tokens.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/pin-input';
import { PinInput } from '@labpics/ui-react/pin-input';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

function Example() {
  const [done, setDone] = useState('');
  return (
    <form id="react-form">
      <PinInput
        label="Код подтверждения"
        otp
        count={6}
        name="code"
        required
        onValueComplete={(_, value) => {
          setDone(value);
          document.querySelector('#react-form')?.dispatchEvent(new Event('pin-complete'));
        }}
      />
      <output>{done}</output>
      <button type="reset">Сбросить</button>
    </form>
  );
}
const mount = document.getElementById('react');
if (!mount) throw new Error('Missing React fixture root');
createRoot(mount).render(
  <>
    <div className="row" id="react-matrix">
      <PinInput label="Пусто" labelHidden count={4} mask />
      <PinInput label="PIN" labelHidden count={4} mask defaultValue={['1', '2']} />
      <PinInput
        label="Ошибка"
        labelHidden
        count={4}
        mask
        invalid
        type="danger"
        defaultValue={['1', '2']}
      />
    </div>
    <Example />
  </>,
);
