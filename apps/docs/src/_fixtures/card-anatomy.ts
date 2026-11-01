import type { LabCard } from '@labpics/ui-core/card';
import { hydrateRoot, type Root } from 'react-dom/client';
import { cardSpecs } from './card-anatomy-cases';
import { reactCard } from './card-anatomy-react';

const roots = new Map<string, Root>();
const errors: string[] = [];
const activations: string[] = [];
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (target.matches('[data-probe="footer"]')) activations.push(target.closest('[id]')?.id ?? '');
});

const hooks = {
  errors,
  activations,
  async hydrate() {
    await import('@lit-labs/ssr-client/lit-element-hydrate-support.js');
    await import('@labpics/ui-core/card');
    await import('@labpics/ui-core/button');
    for (const spec of cardSpecs) {
      const mount = document.getElementById(`react-mount-${spec.id}`);
      if (!mount) throw new Error(`Нет React mount: ${spec.id}`);
      roots.set(
        spec.id,
        hydrateRoot(mount, reactCard(spec), {
          onRecoverableError: (error) => errors.push(String(error)),
        }),
      );
    }
    await Promise.all(
      cardSpecs.map(
        (spec) => (document.getElementById(`core-${spec.id}`) as LabCard).updateComplete,
      ),
    );
    await hooks.settle();
  },
  async setImage(value: string) {
    const core = document.getElementById('core-master') as LabCard;
    core.imageSrc = value;
    const spec = cardSpecs.find((spec) => spec.id === 'master');
    if (!spec) throw new Error('Нет master');
    roots.get('master')?.render(reactCard({ ...spec, props: { ...spec.props, imageSrc: value } }));
    await core.updateComplete;
    await hooks.settle();
  },
  async reconnect() {
    const core = document.getElementById('core-master');
    const parent = core?.parentNode;
    if (!core || !parent) throw new Error('Нет master');
    core.remove();
    parent.appendChild(core);
    await (core as LabCard).updateComplete;
    await hooks.settle();
  },
  settle: () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
};
window.__cardAnatomy = hooks;

declare global {
  interface Window {
    __cardAnatomy: typeof hooks;
  }
}
