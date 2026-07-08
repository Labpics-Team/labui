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

  it('запрещает синтетику шрифта на [data-theme]: font-synthesis: none (гард против фейк-наклона)', () => {
    // Решение 2026-07-08: наклон не используем — у Geist italic-ассета НЕТ (одна
    // ось `wght`, vercel/geist-font: 0 italic-файлов), а синтетический наклон
    // ниже планки ДС. Гард обязан стоять на том же скоупе [data-theme], где живёт
    // font-family, — где применяется шрифт ДС, там браузер ничего не подделывает.
    // Тот же бабл `[data-theme] { … font-synthesis: none … }` (в комментарии нет
    // фигурных скобок, поэтому [^}]* доходит до декларации, не выходя из бабла).
    // RED-proof: убрать декларацию — падает; ослабить до `weight` — падает.
    expect(themeCss).toMatch(/\[data-theme\]\s*\{[^}]*font-synthesis:\s*none;/);
  });
});
