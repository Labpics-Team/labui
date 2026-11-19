import '@labpics/ui-core/slider';
import { Slider } from '@labpics/ui-react/slider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in slider.html');

// Test ids ride on wrappers (the Slider owns its prop API — no passthrough). The spec
// targets the `[data-lab-slider]` control inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-single">
      <Slider label="Volume" defaultValue={[40]} showValue helper="Drag or use the arrow keys." />
    </span>
    <span data-testid="react-range">
      <Slider label="Price range" defaultValue={[20, 80]} showValue />
    </span>
    <span data-testid="react-step">
      <Slider label="Step 10" defaultValue={[50]} step={10} />
    </span>
    <span data-testid="react-invalid">
      <Slider label="Volume" defaultValue={[40]} invalid error="Out of allowed range." />
    </span>
    <span data-testid="react-disabled">
      <Slider label="Locked" defaultValue={[30]} disabled />
    </span>
    <span data-testid="react-circular">
      <Slider variant="circular" label="Angle" defaultValue={[0, 40]} />
    </span>
    <span data-testid="react-large">
      <Slider variant="large" label="Large" defaultValue={[40]} />
    </span>
  </StrictMode>,
);
