import { switchStyleVisibility as styleVisibility } from './style-visibility.js';

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
