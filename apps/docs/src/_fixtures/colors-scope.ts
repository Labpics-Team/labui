import {
  type ThemeInput,
  type ThemeScope,
  createThemeScope,
  initializeColors,
} from '@labui/colors/runtime';

declare global {
  interface Window {
    colorsProof: {
      scope: ThemeScope;
      errors: unknown[];
      update: (input?: ThemeInput) => boolean;
    };
  }
}

initializeColors().then(() => {
  const root = document.querySelector<HTMLElement>('#scope');
  const host = document.querySelector<HTMLElement>('#shadow-host');
  if (!root || !host) throw new Error('Missing scope fixture');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML =
    '<style>span { color: var(--lab-label-primary); }</style><span>Shadow text</span>';
  const errors: unknown[] = [];
  const scope = createThemeScope(root, { onError: (error) => errors.push(error) });
  window.colorsProof = { scope, errors, update: (input) => scope.update(input).ok };
});
