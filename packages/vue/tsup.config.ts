import { libraryPreset } from '../../tsup.config.base';

export default libraryPreset({
  // Vue stays external — the consumer's app owns it; we never bundle it (same
  // rule as React in packages/react/tsup.config.ts).
  external: ['vue', /^@labpics\//],
  // Inline the component CSS (button.css) into the JS as a runtime-injected
  // <style>, so importing the component brings its styles with it — no
  // separate stylesheet-import step, and no drift from the React entry's build.
  injectStyle: true,
});
