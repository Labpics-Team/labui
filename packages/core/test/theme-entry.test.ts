import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const coreRoot = fileURLToPath(new URL('..', import.meta.url));

// Реальные package exports после сборки: source aliases Vitest не доказывают
// ни CJS/ESM resolution, ни безопасный импорт в серверном потребителе.
for (const format of ['esm', 'cjs'] as const) {
  test(`theme package entry: ${format} consumer без DOM`, () => {
    const load =
      format === 'esm'
        ? 'const theme = await import("@labpics/ui-core/theme");'
        : 'const { createRequire } = await import("node:module"); const theme = createRequire(import.meta.url)("@labpics/ui-core/theme");';
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      for (const name of ['window', 'document', 'customElements', 'HTMLElement', 'Document', 'CSSStyleSheet']) {
        Object.defineProperty(globalThis, name, {
          configurable: true,
          get() { throw new Error('DOM accessed during theme import: ' + name); },
        });
      }
      ${load}
      if (typeof theme.bindPortalScope !== 'function' || typeof theme.setTheme !== 'function') {
        throw new Error('Missing public scope contract');
      }
      process.stdout.write('theme consumer imported');
    `,
      ],
      { cwd: coreRoot, encoding: 'utf8' },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe('theme consumer imported');
  });
}
