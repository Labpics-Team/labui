import litSsrPlugin from '@lit-labs/nextjs';

/**
 * @lit-labs/nextjs wraps the Next config so Lit components deep-SSR (declarative
 * shadow DOM) on the server and hydrate on the client without manual hacks —
 * this is exactly the "with hacks or not" measurement for criterion 1.
 *
 * The plugin pins peerDependency `next: 13 || 14 || 15`, which is why this
 * fixture stays on Next 15 even though Next 16 is the latest release.
 */
const withLitSSR = litSsrPlugin({ addDeclarativeShadowDomPolyfill: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lit ships as ESM; let Next transpile the workspace prototype package.
  transpilePackages: ['@labpics/proto-a-lit', 'lit', '@lit/react'],
};

export default withLitSSR(nextConfig);
