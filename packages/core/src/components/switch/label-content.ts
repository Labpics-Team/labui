export type SwitchLabelContent = 'empty' | 'present' | 'unknown';

type LabelAttribute =
  | 'aria-label'
  | 'aria-labelledby'
  | 'title'
  | 'role'
  | 'alt'
  | 'class'
  | 'style'
  | 'hidden'
  | 'aria-hidden';

const textWrappers = new Set([
  'span',
  'div',
  'p',
  'b',
  'strong',
  'i',
  'em',
  'small',
  's',
  'u',
  'mark',
  'abbr',
  'bdi',
  'bdo',
  'code',
  'kbd',
  'samp',
  'var',
  'sub',
  'sup',
]);
const nonContent = new Set(['script', 'style', 'template']);
const labelAttributes: LabelAttribute[] = [
  'aria-label',
  'aria-labelledby',
  'title',
  'role',
  'alt',
  'class',
  'style',
  'hidden',
  'aria-hidden',
];

export function switchLabelContents(contents: Iterable<SwitchLabelContent>): SwitchLabelContent {
  let result: SwitchLabelContent = 'empty';
  for (const content of contents) {
    if (content === 'present') return content;
    if (content === 'unknown') result = content;
  }
  return result;
}

function hasAttribute(value: unknown): boolean {
  return typeof value === 'string' ? Boolean(value.trim()) : value !== undefined && value !== null;
}

type Visibility = 'hidden' | 'visible' | 'unknown';
type VisibilityProperty = 'display' | 'visibility' | 'content-visibility';

const cssWhitespace = /[\t\n\f\r ]/;
const cssEscape = String.raw`\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\f\r ])?|[^\n\r\f])`;
const cssIdentifier = new RegExp(
  String.raw`(?:--|-?(?:[_a-z\u0080-\uffff]|${cssEscape}))(?:[-_a-z0-9\u0080-\uffff]|${cssEscape})*`,
  'iy',
);

/** Идентификаторы CSS сохраняют границы tokens и декодируют CSS escapes. */
function cssWords(source: string): string[] | 'unknown' | undefined {
  const words: string[] = [];
  let index = 0;
  while (index < source.length) {
    if (cssWhitespace.test(source.charAt(index))) {
      index += 1;
      continue;
    }
    cssIdentifier.lastIndex = index;
    const token = cssIdentifier.exec(source);
    if (!token) return undefined;
    index = cssIdentifier.lastIndex;
    const word = token[0]
      .replace(
        /\\([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\n\r\f])/gi,
        (escapeText: string, hex?: string, literal?: string) => {
          if (hex === undefined) return literal ?? escapeText;
          const point = Number.parseInt(hex, 16);
          return String.fromCodePoint(
            point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)
              ? 0xfffd
              : point,
          );
        },
      )
      .replace(/[A-Z]/g, (letter) => letter.toLowerCase());
    if (source.charAt(index) === '(')
      return ['var', 'env', 'attr', 'if'].includes(word) ? 'unknown' : undefined;
    words.push(word);
  }
  return words;
}

function visibilityValue(property: VisibilityProperty, source: string): Visibility | undefined {
  const words = cssWords(source);
  if (words === 'unknown') return words;
  if (!words?.length) return undefined;
  if (words.length === 1) {
    const value = words[0];
    if (value === undefined) return undefined;
    if (value === 'initial') return 'visible';
    if (['inherit', 'unset', 'revert', 'revert-layer'].includes(value)) return 'unknown';
    if (property === 'visibility') {
      if (value === 'hidden' || value === 'collapse') return 'hidden';
      return value === 'visible' ? 'visible' : undefined;
    }
    if (property === 'content-visibility') {
      if (value === 'hidden') return 'hidden';
      return value === 'visible' || value === 'auto' ? 'visible' : undefined;
    }
    if (value === 'none') return 'hidden';
    // Поддержка этих display values зависит от движка; SSR не знает итог cascade.
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
  const outers = words.filter((word) => outside.includes(word));
  const inners = words.filter((word) => inside.includes(word));
  const valid =
    outers.length <= 1 &&
    inners.length <= 1 &&
    words.every((word) => outside.includes(word) || inside.includes(word) || word === 'list-item');
  if (!valid) return undefined;
  return words.some((word) => ['run-in', 'ruby', 'math'].includes(word)) ? 'unknown' : 'visible';
}

/** Читаем только visibility declarations; строки и вложенные blocks не разделяются. */
function inlineVisibility(source: string): Visibility {
  const values = new Map<VisibilityProperty, { value: Visibility; important: boolean }>();
  let buffer = '';
  let colon = -1;
  let bang = -1;
  let quote = '';
  const closers: string[] = [];

  function declaration(): void {
    const names = cssWords(buffer.slice(0, colon));
    if (colon >= 0 && Array.isArray(names) && names.length === 1) {
      const property = names[0];
      if (
        property === 'display' ||
        property === 'visibility' ||
        property === 'content-visibility'
      ) {
        const suffix = cssWords(buffer.slice(bang + 1));
        const important =
          bang > colon && Array.isArray(suffix) && suffix.length === 1 && suffix[0] === 'important';
        const value = visibilityValue(
          property,
          buffer.slice(colon + 1, important ? bang : undefined),
        );
        if (value !== undefined && (!values.get(property)?.important || important))
          values.set(property, { value, important });
      }
    }
    buffer = '';
    colon = -1;
    bang = -1;
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);
    if (character === '\\') {
      buffer += character;
      if (index + 1 < source.length) buffer += source.charAt(++index);
      continue;
    }
    if (quote) {
      buffer += character;
      if (character === quote || /[\n\r\f]/.test(character)) quote = '';
      continue;
    }
    if (character === '/' && source.charAt(index + 1) === '*') {
      const end = source.indexOf('*/', index + 2);
      buffer += ' ';
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    if (character === '(' || character === '[' || character === '{')
      closers.push(character === '(' ? ')' : character === '[' ? ']' : '}');
    else if (character === closers.at(-1)) closers.pop();
    if (!quote && !closers.length) {
      if (character === ';') {
        declaration();
        continue;
      }
      if (character === ':' && colon < 0) colon = buffer.length;
      if (character === '!' && colon >= 0) bang = buffer.length;
    }
    buffer += character;
  }
  declaration();
  if ([...values.values()].some(({ value }) => value === 'hidden')) return 'hidden';
  return [...values.values()].some(({ value }) => value === 'unknown') ? 'unknown' : 'visible';
}

function styleVisibility(style: unknown): Visibility {
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

/** Обычные обёртки прозрачны. Opaque content не доказывает доступное имя. */
export function switchLabelElementContent(
  tagName: string,
  readChildren: () => SwitchLabelContent,
  readAttribute: (name: LabelAttribute) => unknown,
  readNativeLabel?: () => SwitchLabelContent,
): SwitchLabelContent {
  const tag = tagName.toLowerCase();
  if (nonContent.has(tag)) return 'empty';
  const hidden = readAttribute('hidden');
  if (hidden !== undefined && hidden !== null && hidden !== false) return 'empty';
  const ariaHidden = readAttribute('aria-hidden');
  const visibility = styleVisibility(readAttribute('style'));
  if (ariaHidden === true || ariaHidden === 'true' || visibility === 'hidden') return 'empty';
  if (visibility === 'unknown') return 'unknown';
  for (const name of ['aria-label', 'title'] as const) {
    const value = readAttribute(name);
    if (typeof value === 'string' && value.trim()) return 'present';
  }
  const alt = tag === 'img' ? readAttribute('alt') : undefined;
  if (typeof alt === 'string' && alt.trim()) return 'present';
  // Input ссылается на end-wrapper. Произвольные IDREF его потомков не образуют
  // новую цепочку; native SVG title при этом остаётся источником имени.
  if (readNativeLabel?.() === 'present') return 'present';
  const content = textWrappers.has(tag) ? readChildren() : 'unknown';
  if (content === 'present') return content;
  for (const name of ['aria-labelledby', 'role'] as const) {
    if (hasAttribute(readAttribute(name))) return 'unknown';
  }
  if (
    content === 'empty' &&
    (hasAttribute(readAttribute('class')) || hasAttribute(readAttribute('style')))
  )
    return 'unknown';
  return content;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function isSlot(node: Node): node is HTMLSlotElement {
  return (
    isElement(node) &&
    node.localName === 'slot' &&
    'assignedNodes' in node &&
    typeof node.assignedNodes === 'function'
  );
}

/** Реальные DOM-потомки, включая slot projection и открытый ShadowRoot. */
export function switchLabelDomContent(
  nodes: Iterable<Node>,
  visit?: (node: Node) => void,
  controlledLabel?: Element,
): SwitchLabelContent {
  const seen = new Set<Node>();
  const children = (nodes: Iterable<Node>): SwitchLabelContent =>
    switchLabelContents([...nodes].map(content));
  const content = (node: Node): SwitchLabelContent => {
    if (seen.has(node)) return 'unknown';
    seen.add(node);
    visit?.(node);
    if (node.nodeType === 3) return node.textContent?.trim() ? 'present' : 'empty';
    if (!isElement(node)) return 'empty';
    if (node.hasAttribute('hidden')) return 'empty';
    if (node.getAttribute('aria-hidden') === 'true') return 'empty';
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (style && styleVisibility(style) === 'hidden') return 'empty';
    if (isSlot(node)) {
      const assigned = node.assignedNodes();
      return children(assigned.length ? assigned : node.childNodes);
    }
    const projected = node.shadowRoot;
    const result = switchLabelElementContent(
      node.localName,
      () => children(node.childNodes),
      (name) =>
        name === 'style' && node.hasAttribute('style') && style ? style : node.getAttribute(name),
      () => {
        if (node.namespaceURI !== 'http://www.w3.org/2000/svg' || node.localName !== 'svg')
          return 'unknown';
        const title = [...node.children].find(
          (child) => child.namespaceURI === node.namespaceURI && child.localName === 'title',
        );
        if (!title) return 'empty';
        visit?.(title);
        return title.textContent?.trim() ? 'present' : 'empty';
      },
    );
    if (result !== 'unknown') return result;
    if (projected) {
      visit?.(projected);
      return children(projected.childNodes);
    }
    // Закрытый ShadowRoot неотличим от ещё не смонтированного custom content.
    if (node.localName.includes('-')) return 'unknown';
    const actual = children(node.childNodes);
    return actual === 'present' ? actual : 'unknown';
  };
  if (!controlledLabel?.hasAttribute('hidden')) return children(nodes);
  const hidden = controlledLabel.getAttribute('hidden') ?? '';
  // WebKit сохраняет старый display потомка под hidden-обёрткой. Измерение
  // исключает только собственное скрытие Switch и восстанавливает его до paint.
  controlledLabel.removeAttribute('hidden');
  try {
    return children(nodes);
  } finally {
    controlledLabel.setAttribute('hidden', hidden);
  }
}

/** Один observer подписи; назначенные извне узлы и shadow roots также наблюдаются. */
export function observeSwitchLabelContent(
  root: Element,
  onChange: (content: SwitchLabelContent) => void,
  controlledLabel?: Element,
): () => void {
  let disposed = false;
  let previous: SwitchLabelContent | undefined;
  let slots = new Set<HTMLSlotElement>();
  const observer = new MutationObserver(refresh);

  function refresh(): void {
    if (disposed) return;
    observer.disconnect();
    for (const slot of slots) slot.removeEventListener('slotchange', refresh);
    slots = new Set<HTMLSlotElement>();
    const roots = new Set<Node>([root]);
    const content = switchLabelDomContent(
      isSlot(root) ? [root] : root.childNodes,
      (node) => {
        if (isSlot(node)) slots.add(node);
        if (![...roots].some((ancestor) => ancestor.contains(node))) roots.add(node);
      },
      controlledLabel,
    );
    for (const node of roots) {
      observer.observe(node, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: [...labelAttributes, 'hidden', 'aria-hidden', 'slot', 'name'],
      });
    }
    for (const slot of slots) slot.addEventListener('slotchange', refresh);
    if (content !== previous) {
      previous = content;
      onChange(content);
    }
  }

  refresh();
  return () => {
    disposed = true;
    observer.disconnect();
    for (const slot of slots) slot.removeEventListener('slotchange', refresh);
    slots.clear();
  };
}
