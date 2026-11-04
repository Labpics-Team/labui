import hydrateCore from '@labpics/ui-core/hydrate';
import type { AstroIntegration } from 'astro';

/**
 * Подключается один раз в astro.config: integrations: [hydrate()].
 * Общий Vite plugin сохраняет порядок Lit hook и LitElement, в том числе
 * при разделении общих модулей между SSR- и CSR-страницами.
 */
export default function hydrate(): AstroIntegration {
  return {
    name: '@labpics/ui-astro/hydrate',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [hydrateCore()],
            define: { 'import.meta.env.LABUI_HYDRATE': 'true' },
          },
        });
      },
    },
  };
}
