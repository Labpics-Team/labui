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
import { globSync, readFileSync } from 'node:fs';
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
 * CSS-объявление `z-index: <value>` (и Lit-css-близнец). Значение — до
 * терминатора `;` ИЛИ `}`: последнее объявление в правиле легально без `;`
 * (`.x { z-index: 900 }`), и его нельзя оставить дырой в гарде. Негативный
 * lookbehind `(?<![-\w])` отсекает кастом-свойство `--z-index` (ручка Floating
 * UI): её имя содержит подстроку «z-index», но property `z-index` ей не является.
 */
const ZINDEX_DECL = /(?<![-\w])z-index\s*:\s*([^;}]+?)\s*(?=[;}])/gi;
/**
 * React-инлайн-стиль: camelCase `zIndex: <value>` в объект-литерале (`.tsx`/`.ts`).
 * Поверхность гарда включает `packages/react/**` .tsx, а идиоматичный React-способ
 * положить слой — именно camelCase, поэтому его нельзя не покрыть. Lookbehind
 * `(?<![.\w])` отсекает доступ к свойству (`getComputedStyle(el).zIndex`); значение
 * — до `,`/`;`/`}`/переноса.
 */
const ZINDEX_CAMEL = /(?<![.\w])zIndex\s*:\s*([^,;}\n]+?)\s*(?=[,;}\n])/g;
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
 * Единая проверка ЗНАЧЕНИЯ z-index (kebab и camelCase формы читают её же — один
 * закон, без второй копии). Три класса: чужое семейство `--lab-*`, несуществующий
 * уровень `--lab-z-*` и голое число в обход шкалы.
 */
function analyzeZValue(
  value: string,
  relPath: string,
  line: number,
  zLevels: Map<string, number>,
  out: ZIndexViolation[],
): void {
  const token = `z-index: ${value}`;

  // (2)(3) Каждый токен --lab-* в значении обязан быть каноническим уровнем шкалы.
  for (const ref of value.matchAll(LAB_REF)) {
    const name = ref[0];
    if (!name.startsWith('--lab-z-')) {
      out.push({
        file: relPath,
        line,
        rule: 'wrong-family',
        token,
        detail: `${name} — не z-семейство: глобальный слой едет только на --lab-z-* (§7)`,
      });
    } else if (!zLevels.has(name)) {
      out.push({
        file: relPath,
        line,
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
      line,
      rule: 'magic-zindex',
      token,
      detail: `голое число z-index "${bare[0].trim()}" — потребляй именованный слой --lab-z-* (нет войнам z-index)`,
    });
  }
}

/**
 * Скан z-index в одном файле. `.ts`/`.tsx` нормализуются из Lit-формы; комментарии
 * срезаются (проза «mirrors z-index into --z-index» не должна спотыкать сканер).
 * Читаются обе формы: CSS `z-index:` и — только в JS/TS — React-инлайн `zIndex:`.
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
    analyzeZValue((m[1] as string).trim(), relPath, lineAt(m.index ?? 0), zLevels, out);
  }
  // camelCase существует только в JS/TS-объекте стилей; в CSS такой формы нет.
  if (isTs) {
    for (const m of text.matchAll(ZINDEX_CAMEL)) {
      analyzeZValue((m[1] as string).trim(), relPath, lineAt(m.index ?? 0), zLevels, out);
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

/** Файл поверхности → нормализованный текст (Lit-форма + срез комментариев). */
function readNormalized(rel: string): string {
  const isTs = rel.endsWith('.ts') || rel.endsWith('.tsx');
  const raw = readFileSync(resolve(repoRoot, rel), 'utf8');
  return stripComments(isTs ? normalizeLit(raw) : raw, isTs);
}

/** `--lab-z-*` уровни, реально потребляемые поверхностью (имя → каноническое значение). */
export function consumedZLevels(): Map<string, number> {
  const zLevels = canonicalZLevels();
  const used = new Map<string, number>();
  for (const rel of fallbackSurfaceFiles()) {
    for (const m of readNormalized(rel).matchAll(ZINDEX_DECL)) {
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

    for (const m of readNormalized(rel).matchAll(ZINDEX_DECL)) {
      for (const ref of (m[1] as string).matchAll(Z_REF)) {
        const set = target.bucket.get(target.name) ?? new Set<string>();
        set.add(ref[0]);
        target.bucket.set(target.name, set);
      }
    }
  }
  return { core, react };
}

/**
 * Целые z-index-литералы в приватном слое механик материалов
 * (`packages/materials/src/**`) — ВНЕ компонентной поверхности гарда. Единственный
 * легальный — локальный `-1` (тинт под лейблом внутри СОБСТВЕННОГО контекста
 * поверхности, docs §7). Возвращается, чтобы тест закрепил границу списком, а не
 * только прозой: новый глобальный слой в materials/*.css сразу покраснеет.
 */
export function materialsZIndexLiterals(): number[] {
  const out: number[] = [];
  for (const abs of globSync(resolve(repoRoot, 'packages/materials/src/**/*.css'))) {
    const css = stripComments(readFileSync(abs, 'utf8'), false);
    for (const m of css.matchAll(ZINDEX_DECL)) {
      const bare = /^-?\d+$/.exec((m[1] as string).trim());
      if (bare) out.push(Number.parseInt(bare[0], 10));
    }
  }
  return out.sort((a, b) => a - b);
}
