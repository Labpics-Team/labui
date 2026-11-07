import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './no-literal-colour-fallback.js';
import {
  canonicalZLevels,
  consumedZLevels,
  materialsZIndexLiterals,
  scanZIndexSource,
  scanZIndexSurface,
  zLevelsByComponent,
} from './no-magic-zindex.js';

/**
 * CI-гард no-magic-zindex (docs/dimension-contract.md §7): z-шкала как
 * самоисполняемый контракт. Утверждает чистоту живого дерева И доказывает, что
 * сканер ловит каждый класс нарушений (зелёный прогон = «чисто», никогда «слепо»)
 * — та же структура, что у соседних размерного/цветовых гардов.
 */
describe('z-index scale is a self-enforcing contract (no z-index wars)', () => {
  const zLevels = canonicalZLevels();

  // ── (1) Живое дерево: вся компонентная поверхность едет на именованных слоях.
  it('every component z-index rides a named --lab-z-* layer (repo-wide, ZERO magic)', () => {
    const violations = scanZIndexSurface();
    const report = violations
      .map((v) => `  ${v.file}:${v.line} [${v.rule}] ${v.token} — ${v.detail}`)
      .join('\n');
    expect(
      violations,
      `z-index war / magic z-index (потребляй --lab-z-* слой шкалы):\n${report}`,
    ).toEqual([]);
  });

  // ── (2) Доказательства детекции — каждый класс нарушения даёт находку (RED-proof).
  it('DETECTS a bare integer z-index (the classic z-index war escalation)', () => {
    expect(scanZIndexSource('p.css', '.x { z-index: 9999; }', zLevels)).toMatchObject([
      { rule: 'magic-zindex', token: 'z-index: 9999' },
    ]);
  });

  it('DETECTS a wrong-family token in z-index (a dimension token that is not a layer)', () => {
    expect(
      scanZIndexSource('p.css', '.x { z-index: var(--lab-space-md, 1rem); }', zLevels),
    ).toMatchObject([{ rule: 'wrong-family' }]);
  });

  it('DETECTS an unknown z-level name (not one of the 15 canonical layers)', () => {
    expect(scanZIndexSource('p.css', '.x { z-index: var(--lab-z-ghost); }', zLevels)).toMatchObject(
      [{ rule: 'unknown-z-level' }],
    );
  });

  it('DETECTS the violation through the Lit litVar() form (normalizeLit path)', () => {
    // Голый литерал, поданный как litVar-фолбэк на ЧУЖОЙ токен — оба класса разом.
    const lit = "z-index: ${litVar('--lab-space-md', '900')};";
    expect(scanZIndexSource('p.ts', lit, zLevels).map((v) => v.rule)).toContain('wrong-family');
  });

  it('DETECTS a bare-number escape even wrapped in calc() around a real layer', () => {
    // calc(var(--lab-z-modal) + 1) — нашёптывание «на 1 выше modal» в обход шкалы.
    expect(
      scanZIndexSource('p.css', '.x { z-index: calc(var(--lab-z-modal) + 1); }', zLevels).some(
        (v) => v.rule === 'magic-zindex',
      ),
    ).toBe(true);
  });

  it('DETECTS a semicolon-less terminal declaration (last decl in a rule, no `;`)', () => {
    // `.x { z-index: 9999 }` — валидный CSS без завершающей `;`; не должен пролезть.
    expect(scanZIndexSource('p.css', '.x { z-index: 9999 }', zLevels)).toMatchObject([
      { rule: 'magic-zindex' },
    ]);
  });

  it('DETECTS a React inline-style camelCase zIndex literal (.tsx surface)', () => {
    // Идиоматичный React-способ положить слой — camelCase в объекте стилей.
    expect(
      scanZIndexSource('c.tsx', 'const s = { zIndex: 9999 };', zLevels).map((v) => v.rule),
    ).toContain('magic-zindex');
  });

  it('IGNORES a property ACCESS to .zIndex and a runtime variable value (camelCase)', () => {
    const ok = [
      'const z = getComputedStyle(el).zIndex;', // чтение свойства, не объявление слоя
      'const s = { zIndex: layerVar };', // рантайм-значение, не голое число
    ].join('\n');
    expect(scanZIndexSource('c.tsx', ok, zLevels)).toEqual([]);
  });

  // ── (3) Негативные доказательства — легальные формы никогда не флагаются.
  it('IGNORES a canonical named layer with its guarded literal fallback', () => {
    const ok = [
      '.a { z-index: var(--lab-z-dropdown, 900); }',
      '.b { z-index: var(--lab-z-modal, 1200); }',
      '.c { z-index: var(--lab-z-tooltip, 1400); }',
      '.d { z-index: var(--lab-z-modal-underlay, 1100); }',
    ].join('\n');
    expect(scanZIndexSource('p.css', ok, zLevels)).toEqual([]);
  });

  it('IGNORES the Lit form of a canonical named layer', () => {
    expect(
      scanZIndexSource('p.ts', "z-index: ${litVar('--lab-z-modal', '1200')};", zLevels),
    ).toEqual([]);
  });

  it('IGNORES a Floating-UI runtime handle (var(--z-index)) and z-index keywords', () => {
    const ok = [
      '.a { z-index: var(--z-index); }', // ручка позиционера Zag, не слой шкалы
      '.b { z-index: auto; }',
      '.c { z-index: inherit; }',
    ].join('\n');
    expect(scanZIndexSource('p.css', ok, zLevels)).toEqual([]);
  });

  it('IGNORES prose that merely mentions z-index in a comment', () => {
    const src = '/* mirrors the content z-index into --z-index for layering */\n.x { color: red; }';
    expect(scanZIndexSource('p.ts', src, zLevels)).toEqual([]);
  });

  // ── (4) Санити шкалы — 15 уровней, primary=0, tooltip=1400, строго монотонна.
  it('the canonical scale is the 15-level gap-100 ladder (primary 0 … tooltip 1400)', () => {
    expect(zLevels.size).toBe(15);
    expect(zLevels.get('--lab-z-primary')).toBe(0);
    expect(zLevels.get('--lab-z-tooltip')).toBe(1400);
    const values = [...zLevels.values()];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1] as number);
    }
  });

  // ── (5) СОХРАННОСТЬ ПОРЯДКА (задача, scope #3): относительный порядок слоёв,
  // которые компоненты реально кладут, — «как сейчас». dropdown ПОД modal,
  // underlay ПОД modal-панелью, tooltip НАД всем. Детерминированно, без флака.
  it('preserves the intended stacking order of the layers components actually use', () => {
    const consumed = consumedZLevels();
    // Card uses secondary; Sheet shares the modal panel and underlay layers.
    expect([...consumed.keys()].sort()).toEqual(
      [
        '--lab-z-secondary',
        '--lab-z-dropdown',
        '--lab-z-modal',
        '--lab-z-modal-underlay',
        '--lab-z-tooltip',
      ].sort(),
    );
    const v = (name: string) => consumed.get(name) as number;
    // Порядок «как сейчас»: dropdown (900) ПОД модалом; скрим (underlay 1100) ПОД
    // панелью (modal 1200); tooltip (1400) НАД всем.
    expect(v('--lab-z-secondary')).toBeLessThan(v('--lab-z-dropdown'));
    expect(v('--lab-z-dropdown')).toBeLessThan(v('--lab-z-modal-underlay'));
    expect(v('--lab-z-modal-underlay')).toBeLessThan(v('--lab-z-modal'));
    expect(v('--lab-z-modal')).toBeLessThan(v('--lab-z-tooltip'));
  });

  // ── (6) ПАРИТЕТ core↔react (задача, scope #4): один компонент кладётся на один
  // слой в обоих рендерерах — иначе Lit и React разъедутся по стеку.
  it('each component uses the SAME z-layers on the Lit and React renderers', () => {
    const { core, react } = zLevelsByComponent();
    const components = [
      'card',
      'combobox',
      'dialog',
      'menu',
      'popover',
      'select',
      'sheet',
      'tooltip',
    ];
    // Compare both full sets: an absent renderer must not disappear in an intersection.
    expect([...core.keys()].sort()).toEqual(components);
    expect([...react.keys()].sort()).toEqual(components);
    for (const name of components) {
      const coreSet = [...(core.get(name) as Set<string>)].sort();
      const reactSet = [...(react.get(name) as Set<string>)].sort();
      expect(reactSet, `${name}: z-layer parity core↔react`).toEqual(coreSet);
    }
    expect([...(core.get('card') as Set<string>)]).toEqual(['--lab-z-secondary']);
    expect([...(core.get('sheet') as Set<string>)].sort()).toEqual([
      '--lab-z-modal',
      '--lab-z-modal-underlay',
    ]);
  });

  // ── (7) Доказательство скоупа — поверхность накрывает реальные компонент-файлы
  // (устаревший/суженный список = тихая дыра, как в MIGRATED-гарде).
  it('the enforced surface covers the real floating-layer component files', () => {
    // Взгляд «в лоб»: если бы поверхность не читала dialog, пронос бы не поймали.
    const dialogCore = readFileSync(
      resolve(repoRoot, 'packages/core/src/components/dialog/lab-dialog.ts'),
      'utf8',
    );
    expect(dialogCore).toContain("litVar('--lab-z-modal', '1200')");
    const { core, react } = zLevelsByComponent();
    expect(core.has('dialog')).toBe(true);
    expect(react.has('dialog')).toBe(true);
  });

  // ── (8) Граница локального стека (docs §7): приватный слой механик материалов
  // ВНЕ компонентной поверхности, но его единственный z-index-литерал — локальный
  // -1 (тинт под лейблом). Аллоулист закрепляет исключение списком: новый
  // ГЛОБАЛЬНЫЙ слой, просочившийся в materials/*.css, тут же покраснеет (иначе
  // carve-out был бы «прозой без исполнения»).
  it('materials keeps ONLY the documented local -1 stacking literal (carve-out is enforced)', () => {
    expect(materialsZIndexLiterals()).toEqual([-1]);
  });
});
