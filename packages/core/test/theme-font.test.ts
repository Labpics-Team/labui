import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * theme.css — контракт скоупа темы. Гарнитура ДС применяется на `[data-theme]`
 * (опт-ин), а НЕ на голом `:root` — иначе перекрасили бы шрифт всего документа
 * хоста. Компоненты на `font: inherit` наследуют её от корня темы.
 * RED-proof: убрать правило [data-theme]{font-family} — падает первый тест;
 * перенести font-family на :root — падает второй (анти-инвазивный инвариант).
 */
const themeCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'theme.css'),
  'utf8',
);

describe('theme.css — гарнитура ДС на скоупе [data-theme]', () => {
  it('применяет font-family: var(--lab-font-family, sans-serif) на [data-theme]', () => {
    // Бабл `[data-theme] { … font-family: var(--lab-font-family, sans-serif) … }`.
    expect(themeCss).toMatch(
      /\[data-theme\]\s*\{[^}]*font-family:\s*var\(--lab-font-family,\s*sans-serif\)/,
    );
  });

  it('НЕ красит документ хоста: font-family нет на голом :root (анти-инвазивность)', () => {
    // Голый `:root { … }` (не `:root:not(...)`) несёт только color-scheme.
    const bareRootBlocks = themeCss.match(/:root\s*\{[^}]*\}/g) ?? [];
    expect(bareRootBlocks.length).toBeGreaterThan(0);
    for (const block of bareRootBlocks) {
      expect(block, 'font-family не должен стоять на голом :root').not.toContain('font-family');
    }
  });
});
