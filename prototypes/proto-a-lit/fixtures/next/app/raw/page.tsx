import { RawButtons } from './raw-buttons';

// Force per-request dynamic rendering so the @lit-labs/ssr-react deep-SSR path
// runs at request time (not just static prerender) — probing whether that
// changes shadow-DOM serialization.
export const dynamic = 'force-dynamic';

// Probes whether @lit-labs/nextjs deep-SSRs a RAW custom-element tag (no
// @lit/react wrapper). Compared against / (wrapper path) this isolates where
// deep SSR succeeds or fails for the matrix.
export default function RawPage() {
  return (
    <main>
      <h1 style={{ color: 'var(--lab-label-primary)', fontSize: '1.5rem' }}>
        Next 15 SSR (raw tag)
      </h1>
      <RawButtons />
    </main>
  );
}
