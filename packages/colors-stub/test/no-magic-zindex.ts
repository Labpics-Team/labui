/**
 * Сканер no-magic-zindex — z-шкала как самоисполняемый контракт.
 *
 * docs/dimension-contract.md §7 — закон, который исполняет этот гард. Компонент
 * НИКОГДА не пишет голое число z-index: каждый глобальный слой едет на именованном
 * токене `--lab-z-*` (15 уровней SSOT @labpics/ui-tokens). Так закрывается КЛАСС
 * «войн z-index»: перекрытие нельзя выиграть, вписав 9999, — только сдвинувшись по
 * шкале. Сосед no-magic-dimension ловит длины px/rem/em, но z-index безразмерный и
 * в его поле не попадает; этот гард закрывает ровно эту дыру.
 *
 * Три класса нарушения в компонентной поверхности (core-компоненты + react-стили —
 * та же поверхность, что у fallbackSurfaceFiles, DIP: один владелец «что такое
 * поверхность компонентов»):
 *   1. MAGIC-ZINDEX    — голое целое `z-index: 9999` вне шкалы.
 *   2. WRONG-FAMILY    — `z-index: var(--lab-space-md)` (токен не z-семейства).
 *   3. UNKNOWN-Z-LEVEL — `var(--lab-z-ghost)` — имя вне 15 канонических уровней.
 *
 * Разделение ответственности: ЗНАЧЕНИЕ фолбэка (`var(--lab-z-modal, 1200)` → 1200)
 * стережёт no-magic-dimension (fallback-drift против канона generated/tokens.css) —
 * здесь оно НЕ дублируется (один владелец правила дрейфа). Рантайм-ручки Floating UI
 * (`var(--z-index)`, не `--lab-`) — не слой шкалы, а вычисленное позиционером
 * значение; легальны и гардом не трогаются.
 *
 * Lit-исходники сперва нормализуются (`litVar('X','f')` → `var(X, f)`), так что один
 * сканер читает shadow-близнеца (TS) и React-близнеца (CSS) одинаково.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot } from './no-literal-colour-fallback.js';
import {
  canonicalTokens,
  fallbackSurfaceFiles,
  normalizeLit,
  stripComments,
} from './no-magic-dimension.js';

/** Одна находка; форма зеркалит размерный гард — единый репортер на все контракты. */
export interface ZIndexViolation {
  readonly file: string;
  readonly line: number;
  readonly rule: 'magic-zindex' | 'wrong-family' | 'unknown-z-level';
  readonly token: string;
  readonly detail: string;
}

/**
 * Канонические уровни z-шкалы (`--lab-z-*` → целое) из СГЕНЕРИРОВАННОГО tokens.css
 * (SSOT-артефакт). Единственный источник имён и значений шкалы — никаких вторых
 * копий списка уровней в гарде.
 */
export function canonicalZLevels(
  canon: Map<string, string> = canonicalTokens(),
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [name, value] of canon) {
    if (!name.startsWith('--lab-z-')) continue;
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n)) out.set(name, n);
  }
  return out;
}

/** Ссылки на `--lab-z-*` внутри значения z-index (для порядка/паритета). */
const Z_REF = /--lab-z-[a-z0-9-]+/g;
/** Любая ссылка `--lab-*` внутри значения z-index (для проверки семейства). */
const LAB_REF = /--lab-[a-z0-9-]+/g;
/**
 * Объявление `z-index: … ;`. Негативный lookbehind `(?<![-\w])` отсекает
 * кастом-свойство `--z-index` (ручка Floating UI): её имя тоже содержит подстроку
 * «z-index», но property `z-index` ей не является.
 */
const ZINDEX_DECL = /(?<![-\w])z-index\s*:\s*([^;]+);/gi;
/** Ключевые слова z-index — не число и не слой, легальны как есть. */
const Z_KEYWORDS = /\b(?:auto|inherit|initial|unset|revert(?:-layer)?)\b/gi;

/** Снять все группы `var(...)` (вложенные — изнутри наружу), оставив остаток. */
function stripVarGroups(text: string): string {
  const varGroup = /var\(\s*--[a-z0-9-_]+\s*(?:,[^()]*)?\)/gi;
  let current = text;
  for (let pass = 0; pass < 8; pass++) {
    const next = current.replace(varGroup, ' ');
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Скан z-index в одном файле. `.ts`/`.tsx` нормализуются из Lit-формы; комментарии
 * срезаются (проза «mirrors z-index into --z-index» не должна спотыкать сканер).
 */
export function scanZIndexSource(
  relPath: string,
  source: string,
  zLevels: Map<string, number> = canonicalZLevels(),
): ZIndexViolation[] {
  const out: ZIndexViolation[] = [];
  const isTs = relPath.endsWith('.ts') || relPath.endsWith('.tsx');
  const text = stripComments(isTs ? normalizeLit(source) : source, isTs);
  const lineAt = (index: number): number => text.slice(0, index).split('\n').length;

  for (const m of text.matchAll(ZINDEX_DECL)) {
    const value = (m[1] as string).trim();
    const at = m.index ?? 0;
    const token = `z-index: ${value}`;

    // (2)(3) Каждый токен --lab-* в значении z-index обязан быть каноническим
    // уровнем шкалы: чужое семейство или несуществующий уровень — дефект.
    for (const ref of value.matchAll(LAB_REF)) {
      const name = ref[0];
      if (!name.startsWith('--lab-z-')) {
        out.push({
          file: relPath,
          line: lineAt(at),
          rule: 'wrong-family',
          token,
          detail: `${name} — не z-семейство: глобальный слой едет только на --lab-z-* (§7)`,
        });
      } else if (!zLevels.has(name)) {
        out.push({
          file: relPath,
          line: lineAt(at),
          rule: 'unknown-z-level',
          token,
          detail: `${name} — имя вне 15 канонических уровней шкалы (generated/tokens.css)`,
        });
      }
    }

    // (1) Остаток без var()-групп и ключевых слов не должен нести голое число:
    // такое число — слой «на глаз» в обход шкалы, ровно война z-index.
    const residue = stripVarGroups(value).replace(Z_KEYWORDS, ' ');
    const bare = /(?<![\w.#-])-?\d+(?:\.\d+)?\b/.exec(residue);
    if (bare) {
      out.push({
        file: relPath,
        line: lineAt(at),
        rule: 'magic-zindex',
        token,
        detail: `голое число z-index "${bare[0].trim()}" — потребляй именованный слой --lab-z-* (нет войнам z-index)`,
      });
    }
  }
  return out;
}

/** Скан всей компонентной поверхности; живое дерево обязано вернуть []. */
export function scanZIndexSurface(): ZIndexViolation[] {
  const zLevels = canonicalZLevels();
  const out: ZIndexViolation[] = [];
  for (const rel of fallbackSurfaceFiles()) {
    const source = readFileSync(resolve(repoRoot, rel), 'utf8');
    out.push(...scanZIndexSource(rel, source, zLevels));
  }
  return out;
}

/** `--lab-z-*` уровни, реально потребляемые поверхностью (имя → каноническое значение). */
export function consumedZLevels(): Map<string, number> {
  const zLevels = canonicalZLevels();
  const used = new Map<string, number>();
  for (const rel of fallbackSurfaceFiles()) {
    const isTs = rel.endsWith('.ts') || rel.endsWith('.tsx');
    const raw = readFileSync(resolve(repoRoot, rel), 'utf8');
    const text = stripComments(isTs ? normalizeLit(raw) : raw, isTs);
    for (const m of text.matchAll(ZINDEX_DECL)) {
      for (const ref of (m[1] as string).matchAll(Z_REF)) {
        const v = zLevels.get(ref[0]);
        if (v !== undefined) used.set(ref[0], v);
      }
    }
  }
  return used;
}

/** Имя компонента → множество его `--lab-z-*` слоёв, для core и react раздельно. */
export function zLevelsByComponent(): {
  core: Map<string, Set<string>>;
  react: Map<string, Set<string>>;
} {
  const core = new Map<string, Set<string>>();
  const react = new Map<string, Set<string>>();

  for (const rel of fallbackSurfaceFiles()) {
    const coreMatch = /packages\/core\/src\/components\/([^/]+)\//.exec(rel);
    const reactMatch = /packages\/react\/src\/([^/]+)\.css$/.exec(rel);
    const target = coreMatch
      ? { name: coreMatch[1] as string, bucket: core }
      : reactMatch
        ? { name: reactMatch[1] as string, bucket: react }
        : null;
    if (!target) continue;

    const isTs = rel.endsWith('.ts');
    const raw = readFileSync(resolve(repoRoot, rel), 'utf8');
    const text = stripComments(isTs ? normalizeLit(raw) : raw, isTs);
    for (const m of text.matchAll(ZINDEX_DECL)) {
      for (const ref of (m[1] as string).matchAll(Z_REF)) {
        const set = target.bucket.get(target.name) ?? new Set<string>();
        set.add(ref[0]);
        target.bucket.set(target.name, set);
      }
    }
  }
  return { core, react };
}
