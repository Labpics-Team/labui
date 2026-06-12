/**
 * Next 15 SSR fixture for the Mitosis-compiled React Button.
 *
 * `transpilePackages`/source live one level up; we import the generated
 * component by relative path. This fixture exists only to PROVE SSR + hydration
 * of the compiled output and to capture FOUC behaviour — it is throwaway.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The compiled Button is plain .tsx outside this app dir; let Next transpile it.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
