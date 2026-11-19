import '@labpics/ui-core/tooltip';
import '@labpics/ui-core/button';
import { Button } from '@labpics/ui-react/button';
import { Tooltip } from '@labpics/ui-react/tooltip';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';
wireThemeSwitch();
const placements = [
  'bottom-start',
  'bottom',
  'bottom-end',
  'right',
  'left',
  'top-start',
  'top',
  'top-end',
] as const;
const types = ['neutral', 'inverted', 'accent'] as const;
const text = 'Hello, my name is Tooltip';
function Example() {
  const [mounted, setMounted] = useState(true);
  const [clicks, setClicks] = useState(0);
  return (
    <StrictMode>
      <button type="button" onClick={() => setMounted(!mounted)} data-testid="toggle">
        Toggle instances
      </button>
      <output data-testid="clicks">{clicks}</output>
      {mounted && (
        <>
          <span data-testid="react-tt-bottom">
            <Tooltip content={text}>
              <Button onClick={() => setClicks(clicks + 1)}>Bottom</Button>
            </Tooltip>
          </span>
          <span data-testid="react-tt-top">
            <Tooltip placement="top" content={text}>
              Top
            </Tooltip>
          </span>
          <span data-testid="react-tt-disabled">
            <Tooltip disabled content="Never shows">
              Disabled
            </Tooltip>
          </span>
          <div className="clipped" data-testid="react-clipped">
            <Tooltip placement="right" content={text}>
              <Button>Clipped</Button>
            </Tooltip>
          </div>
          <div className="lab-scope local-theme" data-theme="light" data-testid="react-local">
            <Tooltip content={text}>
              <Button>Local light</Button>
            </Tooltip>
          </div>
          <div className="author-grid">
            {types.flatMap((type) =>
              placements.map((placement) => (
                <span key={`${type}-${placement}`} data-testid={`react-${type}-${placement}`}>
                  <Tooltip type={type} placement={placement} content={text}>
                    <Button kind="ghost" type="neutral">
                      {type} / {placement}
                    </Button>
                  </Tooltip>
                </span>
              )),
            )}
          </div>
          {types.map((type) => (
            <span key={type} data-testid={`react-bubble-${type}`}>
              <Tooltip type={type} tail="bubble" placement="top" content={text}>
                Bubble {type}
              </Tooltip>
            </span>
          ))}
        </>
      )}
    </StrictMode>
  );
}
const mount = document.getElementById('react-root');
const grid = document.getElementById('lit-grid');
if (!mount || !grid) throw new Error('Tooltip demo mount is missing');
createRoot(mount).render(<Example />);
for (const type of types)
  for (const placement of placements) {
    const tooltip = document.createElement('lab-tooltip');
    tooltip.type = type;
    tooltip.placement = placement;
    tooltip.content = text;
    tooltip.dataset.testid = `lit-${type}-${placement}`;
    const button = document.createElement('lab-button');
    button.kind = 'ghost';
    button.type = 'neutral';
    button.textContent = `${type} / ${placement}`;
    tooltip.append(button);
    grid.append(tooltip);
  }
