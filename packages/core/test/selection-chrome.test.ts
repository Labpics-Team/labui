import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * selection.css — слой браузерного хрома (selection / caret / accent /
 * scrollbar), ось 10 переписи фундамента (task 125). Слой ТОЛЬКО привязывает
 * роли контракта @labpics/colors — ни одного цветового значения; обе темы
 * бесплатно через ребинд ролей под [data-theme].
 * RED-proof: убрать caret-color — падает (1); перенести блок на :root —
 * падает (2); заменить fill-none на transparent — падает (5); вписать px в
 * webkit-фолбэк — падает (6).
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'selection.css'),
  'utf8',
);
/** Комментарии срезаны — законы проверяются по живым декларациям. */
const live = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('selection.css — слой UA-хрома на скоупе [data-theme]', () => {
  it('привязывает caret-color и accent-color к --lab-fill-accent на [data-theme]', () => {
    expect(live).toMatch(/\[data-theme\]\s*\{[^}]*caret-color:\s*var\(--lab-fill-accent\)/);
    expect(live).toMatch(/\[data-theme\]\s*\{[^}]*accent-color:\s*var\(--lab-fill-accent\)/);
  });

  it('стилизует скроллбар ролями: thumb=fill-tertiary, track=fill-none + scrollbar-width', () => {
    expect(live).toMatch(
      /scrollbar-color:\s*var\(--lab-fill-tertiary\)\s+var\(--lab-fill-none\)/,
    );
    expect(live).toMatch(/\[data-theme\]\s*\{[^}]*scrollbar-width:/);
  });

  it('::selection несёт ЕДИНСТВЕННУЮ контрастно-гарантированную пару fill-accent / label-on-accent', () => {
    expect(live).toMatch(/::selection[^{]*\{[^}]*background-color:\s*var\(--lab-fill-accent\)/);
    expect(live).toMatch(/::selection[^{]*\{[^}]*color:\s*var\(--lab-label-on-accent\)/);
    // Обе формы скоупа: сам корень темы и его поддерево.
    expect(live).toContain('[data-theme]::selection');
    expect(live).toContain('[data-theme] ::selection');
  });

  it('НЕ красит документ хоста: каждый селектор файла начинается с [data-theme] (анти-инвазивность)', () => {
    const headers = [...live.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].map((m) => m[1].trim());
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      for (const sel of header.split(',').map((s) => s.trim())) {
        expect(sel, `селектор вне скоупа темы: "${sel}"`).toMatch(/^\[data-theme\]/);
      }
    }
  });

  it('ни одного цветового ЗНАЧЕНИЯ: только var(--lab-*) роли (transparent/hex/rgb запрещены)', () => {
    const vars = [...live.matchAll(/var\(\s*(--[a-z-]+)/g)].map((m) => m[1]);
    expect(vars.length).toBeGreaterThan(0);
    for (const v of vars) expect(v).toMatch(/^--lab-/);
    expect(live).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\btransparent\b/);
  });

  it('webkit-фолбэк: thumb/track/corner покрыты, геометрия остаётся нативной (без размеров)', () => {
    for (const part of ['-thumb', '-track', '-corner']) {
      expect(live).toContain(`::-webkit-scrollbar${part}`);
    }
    // Только цвет: ни px/rem/em, ни width/height/radius в фолбэке и вообще в слое.
    expect(live).not.toMatch(/\d(px|rem|em)\b/);
    expect(live).not.toMatch(/(?<!scrollbar-)width:|height:|border-radius:/);
  });
});
