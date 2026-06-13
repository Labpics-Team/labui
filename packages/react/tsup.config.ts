import { libraryPreset } from '../../tsup.config.base';

/**
 * React, react-dom, Zag and the core seam stay external — the consumer's app
 * owns React; we never bundle it. Keeps the renderer thin (ADR-0001: the React
 * path is a second VISUAL implementation, not a second framework copy).
 */
export default libraryPreset({
  external: ['react', 'react-dom', 'react/jsx-runtime', /^@zag-js\//, /^@labpics\//],
});
