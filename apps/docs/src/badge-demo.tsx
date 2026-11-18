import '@labpics/ui-core/badge';
import { Badge } from '@labpics/ui-react';
import { badgeProfile } from '@labpics/ui-tokens';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import sourceIcon from './_fixtures/badge/figma-comparison-icon.svg?raw';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();
const sourceGlyph = new DOMParser().parseFromString(sourceIcon, 'image/svg+xml').documentElement;
const glyphPaths = [...sourceGlyph.querySelectorAll('path')].map(
  (path) => path.getAttribute('d') ?? '',
);
const comparisonIcon = (
  <svg
    viewBox={sourceGlyph.getAttribute('viewBox') ?? '0 0 24 24'}
    fill="currentColor"
    aria-hidden="true"
  >
    {glyphPaths.map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);
const colors = Object.keys(badgeProfile.colors) as (keyof typeof badgeProfile.colors)[];
const variants = colors.flatMap((color) =>
  (['fill', 'tinted'] as const).flatMap((type) =>
    [false, true].map((disabled) => ({ color, type, disabled })),
  ),
);
const key = ({ color, type, disabled }: (typeof variants)[number]) =>
  `${color}-${type}-${disabled ? 'disabled' : 'enabled'}`;
const lit = document.querySelector('#lit-grid');
const react = document.querySelector('#react-root');
if (!lit || !react) throw new Error('Badge specimen mount missing');
for (const variant of variants) {
  const cell = document.createElement('div');
  cell.className = 'badge-cell';
  const badge = document.createElement('lab-badge');
  badge.color = variant.color;
  badge.type = variant.type;
  badge.disabled = variant.disabled;
  badge.dataset.testid = `lit-${key(variant)}`;
  badge.textContent = 'Badge';
  for (const slot of ['icon', 'icon-end']) {
    const icon = sourceGlyph.cloneNode(true) as Element;
    icon.setAttribute('slot', slot);
    badge.append(icon);
  }
  cell.append(badge);
  lit.append(cell);
}
createRoot(react).render(
  <StrictMode>
    {variants.map((variant) => (
      <div className="badge-cell" key={key(variant)}>
        <Badge
          {...variant}
          data-testid={`react-${key(variant)}`}
          icon={comparisonIcon}
          iconEnd={comparisonIcon}
        >
          Badge
        </Badge>
      </div>
    ))}
  </StrictMode>,
);
