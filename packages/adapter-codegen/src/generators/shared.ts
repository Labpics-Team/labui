/**
 * Общие утилиты генераторов: заголовок «СГЕНЕРИРОВАНО», запись файлов только при
 * изменении (стабильный mtime), сериализация значений.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Размер остаётся у ::slotted в ядре; адаптер переносит его только на прямого ребёнка.
 * Маркер ставится лишь для data-sizing="fill". Стиль уходит в незанятый именованный
 * слот, поэтому не меняет default-контент и не мешает :empty у коробки иконки.
 */
export const slotFillCss =
  ':where([data-lab-slot-fill]) > *{inline-size:100%;block-size:100%}[data-lab-slot-fill]:empty{display:none!important}';

export const slotFillMarkup = `<style slot="_lab-style">${slotFillCss}</style>`;

/** Один источник CSS для runtime-обёрток и строкового SSR. */
export function slotProjectionFile(): string {
  return `${generatedHeader()}\nexport const slotFillCss =\n  ${tsStringLiteral(slotFillCss)};\nexport const slotFillMarkup = \`<style slot="_lab-style">\${slotFillCss}</style>\`;\n`;
}

/** Заголовок-предупреждение для каждого сгенерированного файла (RU, с «почему»). */
export function generatedHeader(commentSyntax: 'block' | 'line' = 'block'): string {
  const lines = [
    'СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.',
    'Источник истины: packages/adapter-codegen/manifest.generated.json,',
    'выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).',
    'Регенерация: pnpm --filter @labpics/adapter-codegen generate.',
    'Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.',
  ];
  if (commentSyntax === 'line') {
    return lines.map((l) => `<!-- ${l} -->`).join('\n');
  }
  return `/**\n${lines.map((l) => ` * ${l}`).join('\n')}\n */`;
}

/** Записывает файл, создавая каталоги. Возвращает true, если содержимое изменилось. */
export function writeIfChanged(path: string, content: string): boolean {
  let previous: string | undefined;
  try {
    previous = readFileSync(path, 'utf8');
  } catch {
    previous = undefined;
  }
  if (previous === content) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return true;
}

/**
 * Оборачивает значение в одинарные кавычки, экранируя бэкслеш и кавычку, —
 * иначе имя с `'`/`\` (напр. событие `it's-open`) эмитило бы невалидный TS.
 * Бэкслеш экранируется первым, чтобы не удвоить уже вставленные экранирования.
 */
function tsStringLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Массив строк в TS-литерал одинарных кавычек: ['a','b']. */
export function tsStringArray(values: readonly string[]): string {
  return `[${values.map(tsStringLiteral).join(', ')}]`;
}

/** Union строковых литералов или 'never' для пустого списка событий. */
export function tsStringUnion(values: readonly string[]): string {
  if (values.length === 0) return 'never';
  return values.map(tsStringLiteral).join(' | ');
}
