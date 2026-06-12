import { ButtonShowcase } from './button-showcase';

/**
 * Server Component shell (dive-next P1): the page itself ships zero JS. The
 * interactive, typed Lit wrapper lives in a Client leaf (button-showcase).
 *
 * @lit-labs/nextjs deep-SSRs the <lab-button> custom element to declarative
 * shadow DOM in the initial HTML, then hydrates it — the criterion-1 proof.
 */
export default function Page() {
  return (
    <main>
      <h1 style={{ color: 'var(--lab-label-primary)', fontSize: '1.5rem' }}>Next 15 SSR</h1>
      <ButtonShowcase />
    </main>
  );
}
