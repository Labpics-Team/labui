import type { PropertyDeclaration } from 'lit';

/** Resources render on the server but are supplied by the client module at hydration. */
export interface LabPropertyDeclaration extends PropertyDeclaration {
  readonly resource?: boolean;
}
