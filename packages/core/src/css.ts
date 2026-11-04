import { type LabVar, concentricRadius, cssVar } from '@labpics/ui-core/shared';
import { type CSSResult, unsafeCSS } from 'lit';

export {
  type LabVar,
  type LabVarClass,
  classifyLabVar,
  concentricRadius,
  cssVar,
  DIMENSION_PREFIXES,
  FORBIDDEN_PRIMITIVE_PREFIXES,
  SEMANTIC_ROLE_PREFIXES,
} from '@labpics/ui-core/shared';

/** CSSResult для контролируемого имени токена, без пользовательского ввода. */
export function litVar(name: LabVar, fallback?: LabVar | (string & {})): CSSResult {
  return unsafeCSS(cssVar(name, fallback));
}

/** Та же формула вложенного радиуса в типе Lit CSSResult. */
export function litConcentricRadius(outer: string, inset: string): CSSResult {
  return unsafeCSS(concentricRadius(outer, inset));
}
