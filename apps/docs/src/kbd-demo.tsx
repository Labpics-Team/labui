import '@labpics/ui-core/kbd';
import { Kbd } from '@labpics/ui-react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();
const keys = ['\u2318', '\u21e7', 'C', 'V'];
const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing Kbd demo root');
createRoot(mount).render(
  <>
    {(['s', 'l'] as const).map((size) => (
      <div className="kbd-row" key={size}>
        {[1, 2, 3, 4].map((count) => (
          <Kbd
            key={count}
            size={size}
            keys={keys.slice(0, count)}
            data-testid={`react-${size}-${count}`}
          />
        ))}
      </div>
    ))}
    <div className="kbd-row">
      <Kbd data-testid="react-slot">Esc</Kbd>
      <Kbd data-testid="react-long" size="l" keys={['Ctrl', 'Shift', 'Enter']} />
      <Kbd data-testid="react-alias" size="m">
        M
      </Kbd>
    </div>
  </>,
);
