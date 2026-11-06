export type SwitchStyleVisibility = 'hidden' | 'visible' | 'unknown';
type VisibilityProperty = 'display' | 'visibility' | 'content-visibility';

type CssAtom = {
  kind:
    | 'ident'
    | 'number'
    | 'dimension'
    | 'percentage'
    | 'hash'
    | 'at-keyword'
    | 'url'
    | 'string'
    | 'space'
    | 'delimiter'
    | 'invalid';
  value: string;
};
type CssGroup = { kind: 'function' | 'block'; name: string; values: CssComponent[] };
type CssComponent = CssAtom | CssGroup;

const whitespace = /[\t\n\f\r ]/;
const hex = /[\da-f]/i;
const escapePattern = String.raw`\\(?:[\da-f]{1,6}[\t\n\f\r ]?|[^\n\r\f]|$)`;
const nameSequence = new RegExp(String.raw`(?:[-_a-z0-9\u0080-\uffff]|${escapePattern})+`, 'iy');
const identifier = new RegExp(
  String.raw`(?:--|-?(?:[_a-z\u0080-\uffff]|${escapePattern}))(?:[-_a-z0-9\u0080-\uffff]|${escapePattern})*`,
  'iy',
);
const number = /[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?/iy;
const lower = (value: string): string => value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());

function codePoint(value: number): string {
  return String.fromCodePoint(
    value === 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff) ? 0xfffd : value,
  );
}

function identifierValue(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (value.charAt(index) === '\\') {
      const escaped = consumeEscape(value, index);
      result += escaped.value;
      index = escaped.end;
    } else {
      result += value.charAt(index);
      index += 1;
    }
  }
  return result;
}

/** CSS Syntax 3: hex escape потребляет до шести цифр и один whitespace terminator. */
function consumeEscape(source: string, start: number): { value: string; end: number } {
  let end = start + 1;
  if (source.charAt(end) === '\n') return { value: '', end: end + 1 };
  if (hex.test(source.charAt(end))) {
    const digits = end;
    while (end - digits < 6 && hex.test(source.charAt(end))) end += 1;
    const value = codePoint(Number.parseInt(source.slice(digits, end), 16));
    if (whitespace.test(source.charAt(end))) end += 1;
    return { value, end };
  }
  const value = source.codePointAt(end);
  return value === undefined
    ? { value: '\ufffd', end }
    : { value: String.fromCodePoint(value), end: end + (value > 0xffff ? 2 : 1) };
}

/** Один lexical contract для declarations, strings и всех вложенных functions/blocks. */
function components(input: string): CssComponent[] {
  const source = input
    .replace(/\r\n?|\f/g, '\n')
    .replaceAll('\0', '\ufffd')
    .replace(/[\ud800-\udfff]/gu, '\ufffd');
  const root: CssComponent[] = [];
  const parents: Array<{ closer: string; values: CssComponent[] }> = [];
  let values = root;
  let index = 0;

  while (index < source.length) {
    const character = source.charAt(index);
    if (whitespace.test(character)) {
      const start = index;
      while (whitespace.test(source.charAt(index))) index += 1;
      values.push({ kind: 'space', value: source.slice(start, index) });
      continue;
    }
    if (character === '/' && source.charAt(index + 1) === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      let value = '';
      let kind: CssAtom['kind'] = 'string';
      index += 1;
      while (index < source.length && source.charAt(index) !== quote) {
        if (source.charAt(index) === '\n') {
          kind = 'invalid';
          break;
        }
        if (source.charAt(index) === '\\') {
          if (index + 1 === source.length) {
            index += 1;
            continue;
          }
          const escaped = consumeEscape(source, index);
          value += escaped.value;
          index = escaped.end;
        } else {
          value += source.charAt(index);
          index += 1;
        }
      }
      if (source.charAt(index) === quote) index += 1;
      values.push({ kind, value });
      continue;
    }

    if (character === '#' || character === '@') {
      const pattern = character === '#' ? nameSequence : identifier;
      pattern.lastIndex = index + 1;
      const name = pattern.exec(source);
      if (name) {
        values.push({
          kind: character === '#' ? 'hash' : 'at-keyword',
          value: identifierValue(name[0]),
        });
        index = pattern.lastIndex;
        continue;
      }
    }
    if (source.startsWith('<!--', index) || source.startsWith('-->', index)) {
      const value = source.startsWith('<!--', index) ? '<!--' : '-->';
      values.push({ kind: 'delimiter', value });
      index += value.length;
      continue;
    }

    identifier.lastIndex = index;
    const ident = identifier.exec(source);
    if (ident) {
      const name = identifierValue(ident[0]);
      index = identifier.lastIndex;
      if (source.charAt(index) !== '(') {
        values.push({ kind: 'ident', value: name });
        continue;
      }
      index += 1;
      let argument = index;
      while (whitespace.test(source.charAt(argument))) argument += 1;
      if (lower(name) === 'url' && !['"', "'"].includes(source.charAt(argument))) {
        // Unquoted url() — один URL token; var-looking text в нём не является function.
        let valid = true;
        let value = '';
        index = argument;
        while (index < source.length && source.charAt(index) !== ')') {
          const next = source.charAt(index);
          if (whitespace.test(next)) {
            while (whitespace.test(source.charAt(index))) index += 1;
            if (index < source.length && source.charAt(index) !== ')') valid = false;
            continue;
          }
          if (next === '\\' && source.charAt(index + 1) !== '\n') {
            const escaped = consumeEscape(source, index);
            value += escaped.value;
            index = escaped.end;
            continue;
          }
          const point = source.codePointAt(index);
          if (
            next === '(' ||
            next === '"' ||
            next === "'" ||
            next === '\\' ||
            (point !== undefined &&
              (point <= 8 || point === 11 || (point >= 14 && point <= 31) || point === 127))
          )
            valid = false;
          value += next;
          index += 1;
        }
        if (source.charAt(index) === ')') index += 1;
        values.push({ kind: valid ? 'url' : 'invalid', value });
        continue;
      }
      const group: CssGroup = { kind: 'function', name: lower(name), values: [] };
      values.push(group);
      parents.push({ closer: ')', values });
      values = group.values;
      continue;
    }

    number.lastIndex = index;
    const numeric = number.exec(source);
    if (numeric) {
      index = number.lastIndex;
      identifier.lastIndex = index;
      const unit = identifier.exec(source);
      if (unit) {
        values.push({ kind: 'dimension', value: numeric[0] + identifierValue(unit[0]) });
        index = identifier.lastIndex;
      } else if (source.charAt(index) === '%') {
        values.push({ kind: 'percentage', value: numeric[0] });
        index += 1;
      } else values.push({ kind: 'number', value: numeric[0] });
      continue;
    }
    if (character === '(' || character === '[' || character === '{') {
      const group: CssGroup = { kind: 'block', name: character, values: [] };
      values.push(group);
      parents.push({ closer: character === '(' ? ')' : character === '[' ? ']' : '}', values });
      values = group.values;
    } else if (character === ')' || character === ']' || character === '}') {
      const parent = parents.at(-1);
      if (parent?.closer === character) {
        parents.pop();
        values = parent.values;
      } else values.push({ kind: 'invalid', value: character });
    } else values.push({ kind: 'delimiter', value: character });
    index += 1;
  }
  // CSS Syntax закрывает незавершённые functions/blocks при EOF.
  return root;
}

const compact = (values: CssComponent[]): CssComponent[] =>
  values.filter((value) => value.kind !== 'space');
const word = (value: CssComponent | undefined): string | undefined =>
  value?.kind === 'ident' ? lower(value.value) : undefined;
const delimiter = (value: CssComponent | undefined, expected: string): boolean =>
  value?.kind === 'delimiter' && value.value === expected;

function declarationValue(values: CssComponent[]): boolean {
  return values.every(
    (value) => value.kind !== 'invalid' && !delimiter(value, '!') && !delimiter(value, ';'),
  );
}

/** Values 5 <syntax>; whitespace внутри type brackets и перед multiplier запрещён. */
function syntax(input: CssComponent[]): boolean {
  let values = input;
  while (compact(values).length === 1) {
    const value = compact(values)[0];
    if (value?.kind !== 'string') break;
    values = components(value.value);
  }
  const tokens = compact(values);
  if (tokens.length === 1 && delimiter(tokens[0], '*')) return true;
  const types = [
    'angle',
    'color',
    'custom-ident',
    'image',
    'integer',
    'length',
    'length-percentage',
    'number',
    'percentage',
    'resolution',
    'string',
    'time',
    'url',
    'transform-function',
    'transform-list',
  ];
  let index = 0;
  while (index < values.length && values[index]?.kind === 'space') index += 1;
  if (index === values.length) return false;
  while (index < values.length) {
    let repeated = false;
    if (delimiter(values[index], '<')) {
      const type = word(values[index + 1]);
      if (!type || !types.includes(type) || !delimiter(values[index + 2], '>')) return false;
      repeated = type === 'transform-list';
      index += 3;
    } else if (word(values[index]) !== undefined) index += 1;
    else return false;
    if (delimiter(values[index], '#') || delimiter(values[index], '+')) {
      if (repeated) return false;
      index += 1;
    }
    while (values[index]?.kind === 'space') index += 1;
    if (index === values.length) return true;
    if (!delimiter(values[index], '|')) return false;
    index += 1;
    while (values[index]?.kind === 'space') index += 1;
  }
  return false;
}

function attributeSyntax(values: CssComponent[]): boolean {
  const tokens = compact(values);
  // Поддерживаем также существующие браузерные attr-type формы type() и %.
  if (tokens.length === 1) {
    if (delimiter(tokens[0], '%')) return true;
    const type = tokens[0];
    if (type?.kind === 'function' && type.name === 'type') return syntax(type.values);
  }
  return syntax(values);
}

/** Values 5 boolean-expr: not group, либо однородная and/or цепочка groups. */
function condition(input: CssComponent[]): boolean {
  const initial = compact(input);
  if (initial.length === 1 && word(initial[0]) === 'else') return true;
  const pending = [initial];
  while (pending.length) {
    const values = pending.pop();
    if (!values?.length) return false;
    const unary = word(values[0]) === 'not';
    const groups = unary ? values.slice(1) : values;
    if ((unary && groups.length !== 1) || groups.length % 2 === 0) return false;
    let operator: string | undefined;
    for (let index = 0; index < groups.length; index += 1) {
      const value = groups[index];
      if (index % 2) {
        const next = word(value);
        if ((next !== 'and' && next !== 'or') || (operator !== undefined && operator !== next))
          return false;
        operator = next;
      } else if (value?.kind === 'function') {
        // general-enclosed сохраняет future-compatible condition как unknown.
      } else if (value?.kind === 'block' && value.name === '(') {
        const body = compact(value.values);
        const first = word(body[0]);
        if (first !== undefined && !['not', 'and', 'or'].includes(first)) continue;
        pending.push(body);
      } else return false;
    }
  }
  return true;
}

function validSubstitution(group: CssGroup): boolean {
  const values = compact(group.values);
  const comma = values.findIndex((value) => delimiter(value, ','));
  const first = comma < 0 ? values : values.slice(0, comma);
  if (group.name !== 'if' && comma >= 0 && !declarationValue(values.slice(comma + 1))) return false;
  if (group.name === 'var') {
    const name = first[0]?.kind === 'ident' ? first[0].value : undefined;
    return first.length === 1 && Boolean(name?.startsWith('--') && name.length > 2);
  }
  if (group.name === 'env') {
    const name = word(first[0]);
    if (
      !name ||
      ['initial', 'inherit', 'unset', 'revert', 'revert-layer', 'default'].includes(name)
    )
      return false;
    return first
      .slice(1)
      .every(
        (value) =>
          value.kind === 'number' && /^[+-]?\d+$/.test(value.value) && Number(value.value) >= 0,
      );
  }
  if (group.name === 'attr') {
    if (word(first[0]) === undefined) return false;
    let index = 1;
    if (delimiter(first[index], '|')) {
      if (word(first[index + 1]) === undefined) return false;
      index += 2;
    }
    // После namespace name нужен полный оставшийся <syntax>, с его whitespace.
    if (index === first.length) return true;
    const syntaxFirst = first[index];
    if (!syntaxFirst) return false;
    const syntaxStart = group.values.indexOf(syntaxFirst);
    const commaToken = values[comma];
    return (
      syntaxStart >= 0 &&
      attributeSyntax(
        group.values.slice(
          syntaxStart,
          commaToken === undefined ? undefined : group.values.indexOf(commaToken),
        ),
      )
    );
  }
  if (group.name === 'if') {
    if (!values.length) return false;
    let start = 0;
    for (let index = 0; index <= values.length; index += 1) {
      if (index < values.length && !delimiter(values[index], ';')) continue;
      const clause = values.slice(start, index);
      if (!clause.length) return index === values.length && start > 0;
      const colon = clause.findIndex((value) => delimiter(value, ':'));
      if (
        colon < 0 ||
        !condition(clause.slice(0, colon)) ||
        !declarationValue(clause.slice(colon + 1))
      )
        return false;
      start = index + 1;
    }
    return true;
  }
  return true;
}

function substitution(values: CssComponent[]): 'unknown' | 'none' | undefined {
  const pending = [...values];
  let unresolved = false;
  while (pending.length) {
    const value = pending.pop();
    if (value?.kind === 'invalid') return undefined;
    if (value?.kind !== 'function' && value?.kind !== 'block') continue;
    if (value.kind === 'function' && ['var', 'env', 'attr', 'if'].includes(value.name)) {
      if (!validSubstitution(value)) return undefined;
      unresolved = true;
    }
    pending.push(...value.values);
  }
  return unresolved ? 'unknown' : 'none';
}

function visibilityValue(
  property: VisibilityProperty | 'all',
  values: CssComponent[],
): SwitchStyleVisibility | undefined {
  if (!declarationValue(values)) return undefined;
  if (values.length > 1 && values.some((value) => value.kind === 'block' && value.name === '{'))
    return undefined;
  const pending = substitution(values);
  if (pending !== 'none') return pending;
  if (!values.length || values.some((value) => value.kind !== 'ident')) return undefined;
  const words = values.map((value) => word(value) ?? '');
  if (words.length === 1) {
    const value = words[0];
    if (value === undefined) return undefined;
    if (value === 'initial') return 'visible';
    if (['inherit', 'unset', 'revert', 'revert-layer'].includes(value)) return 'unknown';
    if (property === 'all') return undefined;
    if (property === 'visibility')
      return value === 'hidden' || value === 'collapse'
        ? 'hidden'
        : value === 'visible'
          ? 'visible'
          : undefined;
    if (property === 'content-visibility')
      return value === 'hidden'
        ? 'hidden'
        : value === 'visible' || value === 'auto'
          ? 'visible'
          : undefined;
    if (value === 'none') return 'hidden';
    if (
      value.startsWith('-') ||
      ['ruby-base', 'ruby-text', 'ruby-base-container', 'ruby-text-container'].includes(value)
    )
      return 'unknown';
    if (
      [
        'contents',
        'inline-block',
        'inline-table',
        'inline-flex',
        'inline-grid',
        'table-row-group',
        'table-header-group',
        'table-footer-group',
        'table-row',
        'table-cell',
        'table-column-group',
        'table-column',
        'table-caption',
      ].includes(value)
    )
      return 'visible';
  }
  if (property !== 'display' || new Set(words).size !== words.length) return undefined;
  const outside = ['block', 'inline', 'run-in'];
  const inside = words.includes('list-item')
    ? ['flow', 'flow-root']
    : ['flow', 'flow-root', 'table', 'flex', 'grid', 'ruby', 'math'];
  const valid =
    words.filter((value) => outside.includes(value)).length <= 1 &&
    words.filter((value) => inside.includes(value)).length <= 1 &&
    words.every(
      (value) => outside.includes(value) || inside.includes(value) || value === 'list-item',
    );
  if (!valid) return undefined;
  return words.some((value) => ['run-in', 'ruby', 'math'].includes(value)) ? 'unknown' : 'visible';
}

function inlineVisibility(source: string): SwitchStyleVisibility {
  const declarations = components(source);
  const values = new Map<
    VisibilityProperty,
    { value: SwitchStyleVisibility; important: boolean }
  >();
  let index = 0;
  while (index < declarations.length) {
    if (declarations[index]?.kind === 'space' || delimiter(declarations[index], ';')) {
      index += 1;
      continue;
    }
    if (declarations[index]?.kind === 'at-keyword') {
      // At-rule не является inline declaration; после его блока parsing продолжается.
      index += 1;
      while (index < declarations.length) {
        const value = declarations[index];
        index += 1;
        if (delimiter(value, ';') || (value?.kind === 'block' && value.name === '{')) break;
      }
      continue;
    }
    const start = index;
    while (index < declarations.length && !delimiter(declarations[index], ';')) index += 1;
    const tokens = compact(declarations.slice(start, index));
    index += 1;
    const property = word(tokens[0]);
    if (
      (property !== 'display' &&
        property !== 'visibility' &&
        property !== 'content-visibility' &&
        property !== 'all') ||
      !delimiter(tokens[1], ':')
    )
      continue;
    const important = delimiter(tokens.at(-2), '!') && word(tokens.at(-1)) === 'important';
    const value = visibilityValue(property, tokens.slice(2, important ? -2 : undefined));
    if (value === undefined) continue;
    const properties: VisibilityProperty[] =
      property === 'all' ? ['display', 'visibility', 'content-visibility'] : [property];
    for (const target of properties) {
      if (!values.get(target)?.important || important) values.set(target, { value, important });
    }
  }
  if ([...values.values()].some(({ value }) => value === 'hidden')) return 'hidden';
  return [...values.values()].some(({ value }) => value === 'unknown') ? 'unknown' : 'visible';
}

export function switchStyleVisibility(style: unknown): SwitchStyleVisibility {
  if (typeof style === 'string') return inlineVisibility(style);
  if (!style || typeof style !== 'object') return 'visible';
  if ('getPropertyValue' in style && typeof style.getPropertyValue === 'function') {
    return ('display' in style && style.display === 'none') ||
      ('visibility' in style &&
        (style.visibility === 'hidden' || style.visibility === 'collapse')) ||
      ('contentVisibility' in style && style.contentVisibility === 'hidden')
      ? 'hidden'
      : 'visible';
  }
  return inlineVisibility(
    Object.entries(style)
      .flatMap(([name, value]) =>
        typeof value === 'string'
          ? [`${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value};`]
          : [],
      )
      .join(''),
  );
}
