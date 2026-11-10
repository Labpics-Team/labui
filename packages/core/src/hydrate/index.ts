import { fileURLToPath } from 'node:url';
import MagicString from 'magic-string';
import type { Plugin } from 'vite';

const supportEntry = '@lit-labs/ssr-client/lit-element-hydrate-support.js';
// Эти два entry соответствуют exports LitElement 4.2.2 из закреплённого lit 3.3.3.
const elementEntry = /\/lit-element\/(?:development\/)?lit-element\.js(?:\?.*)?$/;

interface HydrationContext {
  resolve(
    source: string,
    importer: string,
    options: { skipSelf: boolean },
  ): Promise<{ id: string } | null>;
  error(message: string): never;
}

/** Подключает официальный Lit SSR hook как зависимость браузерного LitElement. */
export default function hydrate() {
  const owner = typeof import.meta.url === 'string' ? fileURLToPath(import.meta.url) : __filename;

  return {
    name: '@labpics/ui-core/hydrate',
    enforce: 'pre',
    config: () => ({
      // Node загружает общий ESM/CJS runtime Core и единый реестр Lit.
      // Linked workspace package иначе попадает в Vite ESM evaluator вместе с require().
      ssr: { external: ['@labpics/ui-core'] },
      // Dev optimizer не должен спрятать LitElement внутри предварительного bundle
      // или отделить его directives от общего экземпляра lit-html.
      optimizeDeps: {
        exclude: [
          'lit',
          'lit-element',
          'lit-html',
          '@lit/reactive-element',
          '@lit-labs/ssr-client',
        ],
      },
    }),
    async transform(this: HydrationContext, code: string, id: string, options?: { ssr?: boolean }) {
      // Сужаем обработку до resolve: resolver сам может загружать другие модули.
      // Ожидание общего resolve из каждого transform создаёт циклическое ожидание.
      if (options?.ssr || !elementEntry.test(id.replaceAll('\\', '/'))) return;
      const support = await this.resolve(supportEntry, owner, { skipSelf: true });
      if (!support) {
        return this.error('LabUI SSR: установите @lit-labs/ssr-client рядом с @labpics/ui-core.');
      }
      // Vite выбирает development/production export официальной поддержки.
      const source = new MagicString(code).prepend(`import ${JSON.stringify(support.id)};\n`);
      return {
        code: source.toString(),
        map: source.generateMap({ source: id, includeContent: true, hires: true }),
      };
    },
  } satisfies Plugin;
}
