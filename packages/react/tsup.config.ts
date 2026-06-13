import { libraryPreset } from '../../tsup.config.base';

/**
 * React, react-dom, Zag and the core seam stay external — the consumer's app
 * owns React; we never bundle it. Keeps the renderer thin (ADR-0001: the React
 * path is a second VISUAL implementation, not a second framework copy).
 */
export default libraryPreset({
  external: ['react', 'react-dom', 'react/jsx-runtime', /^@zag-js\//, /^@labpics\//],
  // Inline the component CSS (`button.css`) into the JS as a runtime-injected
  // <style>, so importing the component brings its styles with it in ANY bundler
  // — no separate stylesheet-import step. Without this, tsup emits a sibling
  // .css file but does NOT re-link it from the ESM output, so consumers silently
  // lose the styles (caught by the Lit↔React parity test).
  injectStyle: true,
});
