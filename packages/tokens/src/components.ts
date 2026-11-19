import authored from './components.json' with { type: 'json' };
import { resolveTextStyles } from './resolve-text-styles.mjs';

/** Public profiles keep their numeric shape; text roles have one authored source. */
export default resolveTextStyles(authored);
