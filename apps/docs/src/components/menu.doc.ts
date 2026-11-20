import type { ComponentDoc } from '../template/component-doc.js';
import { menuFamilyDoc } from './menu-family.js';
export const menuDoc: ComponentDoc = {
  ...menuFamilyDoc('lab-menu'),
  slug: 'menu',
  title: 'Menu',
  order: 12,
};
