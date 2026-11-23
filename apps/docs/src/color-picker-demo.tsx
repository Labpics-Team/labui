import '@labpics/fonts/fonts.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/tokens.css';
import '@labui/colors/contract.css';
import '@labpics/ui-core/color-picker';
import { ColorPicker, type LabColorValue } from '@labpics/ui-react/color-picker';
import { createRoot } from 'react-dom/client';
import { useState, createElement } from 'react';
import { serializeColor } from '@labpics/ui-core/color-picker';
import './color-picker-demo.css';
const precision: LabColorValue = {
  space: 'hsv',
  coords: [35.123456789, 83.987654321, 91.123456789],
  alpha: 0.5019607843137255,
};
function Demo() {
  const [controlled, setControlled] = useState<LabColorValue | null>(precision);
  return (
    <main>
      <h1>ColorPicker</h1>
      <p>Grid, spectrum and sliders share one precise selected color.</p>
      <div className="pickers">
        <form id="lit-form">
          {createElement('lab-color-picker', { id: 'lit', name: 'color' })}
          <button type="reset">Reset Lit</button>
        </form>
        <form id="react-form">
          <ColorPicker
            name="color"
            onValueChange={(value) => {
              document.querySelector('#react-value')!.textContent = serializeColor(value);
            }}
            onValueChangeEnd={() => {
              const output = document.querySelector('#react-ended')!;
              output.textContent = String(Number(output.textContent) + 1);
            }}
            onClose={() => {
              document.querySelector('#react-close')!.textContent = 'closed';
            }}
          />
          <button type="reset">Reset React</button>
          <output id="react-value" />
          <output id="react-ended">0</output>
          <output id="react-close" />
        </form>
        <form id="controlled-form">
          <ColorPicker
            label="Controlled"
            name="color"
            value={controlled}
            onValueChange={setControlled}
          />
        </form>
        <form id="rejected-form">
          <ColorPicker
            label="Rejected requests"
            name="color"
            value={precision}
            onValueChangeEnd={() => {
              document.querySelector('#rejected-ended')!.textContent = 'unexpected end';
            }}
          />
          <output id="rejected-ended" />
        </form>
      </div>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Demo />);
