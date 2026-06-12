import * as React from 'react';
import { createComponent } from '@lit/react';
import { LabButton } from './lab-button.js';

/**
 * Typed React 19 wrapper — criterion 2 (type-safety) probe.
 *
 * @lit/react's createComponent maps the custom element's reactive properties to
 * typed React props. Authoring <Button type="accent" /> in TSX is type-checked
 * against LabButtonType — a wrong literal is a compile error, NOT an any-hole.
 * Custom events would map here too (none on this prototype).
 */
export const Button = createComponent({
  react: React,
  tagName: 'lab-button',
  elementClass: LabButton,
  events: {},
});
