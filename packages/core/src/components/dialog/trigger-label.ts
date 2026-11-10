const controls = new Set([
  'button',
  'details',
  'embed',
  'iframe',
  'input',
  'label',
  'object',
  'select',
  'summary',
  'textarea',
]);

const controlRoles = new Set([
  'button',
  'checkbox',
  'combobox',
  'grid',
  'gridcell',
  'link',
  'listbox',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'radiogroup',
  'scrollbar',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'tablist',
  'textbox',
  'tree',
  'treegrid',
  'treeitem',
]);

/** Единая политика подписи выбранного opener; SSR передаёт parsed attributes. */
export function isInteractiveTriggerLabelElement(
  tagName: string,
  readAttribute: (name: string) => string | null | undefined,
): boolean {
  const tag = tagName.toLowerCase();
  const present = (name: string): boolean => readAttribute(name) != null;
  const editable = readAttribute('contenteditable');
  return (
    tag.includes('-') ||
    controls.has(tag) ||
    (['a', 'area'].includes(tag) && (present('href') || present('xlink:href'))) ||
    (['audio', 'video'].includes(tag) && present('controls')) ||
    (tag === 'img' && (present('usemap') || present('controls'))) ||
    present('tabindex') ||
    (editable != null && editable.toLowerCase() !== 'false') ||
    (readAttribute('role') ?? '').split(/\s+/).some((role) => controlRoles.has(role))
  );
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

/** @internal Неинтерактивные SVG и rich text допустимы; template content инертен. */
export function hasInteractiveTriggerLabel(nodes: Iterable<Node>): boolean {
  const pending = [...nodes];
  while (pending.length) {
    const node = pending.pop();
    if (!node || !isElement(node)) continue;
    if (isInteractiveTriggerLabelElement(node.localName, (name) => node.getAttribute(name))) {
      return true;
    }
    pending.push(...node.childNodes);
  }
  return false;
}
