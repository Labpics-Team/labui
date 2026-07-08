/**
 * Юнит-тесты сериализаторов строк (класс А + регресс класса Б, issue #128):
 * имя события/слота с `'` или `\` обязано эмитить СИНТАКСИЧЕСКИ ВАЛИДНЫЙ TS.
 * Без экранирования `'it's-open'` — syntax error, ломающий сборку всех адаптеров.
 * Валидность проверяем round-trip через TS-транспайлер (парсит литерал → исходное
 * значение), а не сравнением строк: это ловит КЛАСС «невалидный литерал», а не заплату.
 */
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { tsStringArray, tsStringUnion } from '../src/generators/shared.js';

/** Транспайлит TS-выражение и достаёт рантайм-значение — падает, если литерал невалиден. */
function evalTsExpression<T>(expr: string): T {
  const js = ts.transpileModule(`export const __v = ${expr};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
  });
  const syntaxErrors = (js.diagnostics ?? []).filter(
    (d) => d.category === ts.DiagnosticCategory.Error,
  );
  if (syntaxErrors.length > 0) {
    const msg = syntaxErrors
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      .join('; ');
    throw new Error(`невалидный TS: ${msg}\nисточник: ${expr}`);
  }
  const module = { exports: {} as Record<string, unknown> };
  const run = new Function('module', 'exports', js.outputText);
  run(module, module.exports);
  return module.exports.__v as T;
}

describe('сериализаторы строк экранируют кавычки/бэкслеши (issue #128)', () => {
  // Опасные имена: одинарная кавычка, бэкслеш, обе разом.
  const tricky = ["it's-open", 'back\\slash', "both'\\end"];

  it('tsStringArray: значения с кавычкой/бэкслешем → валидный TS, round-trip совпадает', () => {
    const literal = tsStringArray(tricky);
    expect(evalTsExpression<string[]>(literal)).toEqual([...tricky]);
  });

  it('tsStringUnion: значение с кавычкой → валидный TS-литерал (round-trip)', () => {
    const literal = tsStringUnion(["it's-open"]);
    // Union из одного — это просто строковый литерал; round-trip восстанавливает значение.
    expect(evalTsExpression<string>(literal)).toBe("it's-open");
  });

  it('tsStringUnion: бэкслеш экранируется один раз (не удваивается лишний)', () => {
    const literal = tsStringUnion(['a\\b']);
    expect(evalTsExpression<string>(literal)).toBe('a\\b');
  });

  it('на чистых kebab-именах вывод без изменений (обратная совместимость golden)', () => {
    expect(tsStringArray(['open-change', 'value-change'])).toBe("['open-change', 'value-change']");
    expect(tsStringUnion(['open-change', 'value-change'])).toBe("'open-change' | 'value-change'");
    expect(tsStringUnion([])).toBe('never');
  });
});
