/**
 * Mitosis compile config for the write-once Button.
 *
 * Targets chosen for the honesty test:
 *   - react:  the primary target (Next 15 fixture consumes it).
 *   - svelte: the MOST divergent target from React (compiled framework, no VDOM,
 *             its own reactivity). If write-once survives React→Svelte, the
 *             claim is credible; where it breaks, that is the finding.
 *
 * We deliberately emit TypeScript so the type-safety criterion can be measured
 * on real generated types (no `any` smuggling).
 */
module.exports = {
  files: 'src/**',
  targets: ['react', 'svelte'],
  dest: 'output',
  options: {
    react: {
      typescript: true,
      stylesType: 'style-tag',
      // 'variables' = plain const declarations, the genuinely zero-runtime
      // strategy (no valtio/mobx/solid runtime dep). The default and the
      // (invalid) 'hooks' value silently fall through to valtio's useLocalProxy
      // — see FINDINGS.md "DX / maturity".
      stateType: 'variables',
    },
    svelte: {
      typescript: true,
    },
  },
};
