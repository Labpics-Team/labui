import '@labpics/ui-core/card';
import type { LabCard } from '@labpics/ui-core/card';
import { Card } from '@labpics/ui-react/card';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

type Pattern = 'A' | 'B';
declare global {
  interface Window {
    cardImageFixture: { setImage: (pattern: Pattern) => Promise<void> };
  }
}

const mount = document.getElementById('react-mount');
if (!mount) throw new Error('Нет React mount');
const core = document.querySelector<LabCard>('#core-card');
if (!core) throw new Error('Нет Core Card');
const root = createRoot(mount);
const sources = new Map<Pattern, string>();

function source(pattern: Pattern): string {
  const cached = sources.get(pattern);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 400;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Нет canvas 2d');
  // Непрозрачный сигнал приложения; material tokens остаются продуктовыми.
  const colors =
    pattern === 'A'
      ? ['rgb(216 40 100)', 'rgb(24 180 212)']
      : ['rgb(244 160 32)', 'rgb(32 180 100)'];
  for (let x = 0; x < canvas.width; x += 8) {
    context.fillStyle = colors[(x / 8) % 2] ?? '';
    context.fillRect(x, 0, 8, canvas.height);
  }
  const result = canvas.toDataURL('image/png');
  sources.set(pattern, result);
  return result;
}

function render(imageSrc = ''): void {
  flushSync(() =>
    root.render(
      createElement(
        Card,
        {
          id: 'react-card',
          variant: 'elevated',
          imageSrc,
          imageAlt: 'Полосы',
          'aria-label': 'React Card',
        },
        createElement('div', { className: 'sample', 'aria-hidden': true }),
      ),
    ),
  );
}

async function setImage(pattern: Pattern): Promise<void> {
  if (!core || !mount) throw new Error('Нет Card');
  const imageSrc = source(pattern);
  core.imageSrc = imageSrc;
  core.imageAlt = 'Полосы';
  render(imageSrc);
  await core.updateComplete;
  const images = [
    ...(core.shadowRoot?.querySelectorAll('img') ?? []),
    ...mount.querySelectorAll('img'),
  ];
  if (images.length !== 4) throw new Error('Ожидались два imageSrc изображения у каждой Card');
  await Promise.all(images.map((image) => image.decode()));
}

window.cardImageFixture = { setImage };
if (document.documentElement.hasAttribute('data-image-fixture')) {
  void setImage('A').then(() => {
    document.documentElement.dataset.imageReady = 'true';
  });
} else {
  render();
}
