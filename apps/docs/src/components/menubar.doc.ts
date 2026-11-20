import type { ComponentDoc } from '../template/component-doc.js';
import { menuFamilyDoc } from './menu-family.js';
export const menubarDoc: ComponentDoc = {
  ...menuFamilyDoc('lab-menubar'),
  slug: 'menubar',
  title: 'Menubar',
  order: 14,
};
