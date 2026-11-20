import type { ComponentDoc } from '../template/component-doc.js';
import { menuFamilyDoc } from './menu-family.js';
export const contextMenuDoc: ComponentDoc = {
  ...menuFamilyDoc('lab-context-menu'),
  slug: 'context-menu',
  title: 'Context Menu',
  order: 13,
};
