import { mountMaterialRuntime } from '@labpics/ui-materials';
import css from '@labpics/ui-materials/material.css?inline';

// Deliberate test inputs: lifecycle, scope and media behavior are checked
// independently of the Colors solver. These values are not an author palette.
const sheet = `${css}
  :root,:host { --lab-bg-material-soft-01:rgb(245 245 245 / .2); --lab-bg-material-soft-02:rgb(245 245 245); --lab-bg-static-light:white; --lab-bg-static-dark:black; }
  body { margin:32px; }
  #backdrop { position:fixed;inset:0;z-index:-1;background:repeating-linear-gradient(45deg,#214f65 0 12px,#dfb193 12px 24px); }
  .lab-material {width:240px;height:160px;border-radius:24px;margin:24px;padding:24px;box-sizing:border-box;}
`;
const style = document.createElement('style');
style.textContent = sheet;
document.head.appendChild(style);
const scope = document.querySelector<HTMLElement>('#scope');
const surface = document.querySelector<HTMLElement>('#surface');
const host = document.querySelector<HTMLElement>('#shadow-host');
const ready = document.querySelector('#ready');
if (!scope || !surface || !host || !ready) throw new Error('Missing material fixture elements');
const shadow = host.attachShadow({ mode: 'open' });
shadow.innerHTML = `<style>${sheet}</style><div id="shadow-surface" class="lab-material lab-material--soft">Shadow glass</div>`;
const stop = mountMaterialRuntime(scope);
const stopShadow = mountMaterialRuntime(shadow);
let stopOverlap: (() => void) | undefined;
Object.assign(window, {
  materialFixture: {
    stop,
    stopShadow,
    overlap() {
      stopOverlap = mountMaterialRuntime(surface);
    },
    stopOverlap() {
      stopOverlap?.();
    },
    mount: mountMaterialRuntime,
  },
});
ready.textContent = 'ready';
