import litSsrPlugin from '@lit-labs/nextjs';

/**
 * @lit-labs/nextjs wraps the Next config so Lit components deep-SSR (declarative
 * shadow DOM) on the server and hydrate on the client without manual hacks —
 * this is exactly the "with hacks or not" measurement for criterion 1.
 *
 * The plugin pins peerDependency `next: 13 || 14 || 15`, which is why this
 * fixture stays on Next 15 even though Next 16 is the latest release.
 */
// By default the plugin's Lit-SSR transform EXCLUDES node_modules. Our element
// is consumed from the workspace package (resolved into node_modules), so deep
// SSR is skipped unless we re-include it. We exclude next/dist only, and rely on
// webpackModuleRulesTest also matching the prototype's dist entry.
const withLitSSR = litSsrPlugin({
  addDeclarativeShadowDomPolyfill: true,
  webpackModuleRulesTest:
    /\/pages\/.*\.(?:j|t)sx?$|\/app\/.*\.(?:j|t)sx?$|@labpics[/\\]proto-a-lit/,
  webpackModuleRulesExclude: [/next[/\\]dist[/\\]/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The prototype is consumed as its PREBUILT dist (exports `import` condition),
  // which is already ESM with Lit bundled in — so it is NOT transpiled here.
  // (Adding it to transpilePackages makes Next resolve the `types` source entry
  // and choke on the .js->.ts extension; the dist path avoids that.)
};

export default withLitSSR(nextConfig);
