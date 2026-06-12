'use client';

/**
 * Shared demo matrix used by BOTH SSR fixtures (Next + Astro island).
 *
 * Renders the Mitosis-compiled React Button across its axes inside a themed
 * surface. The component is theme-agnostic: the only thing that changes between
 * the two panels is `data-theme`, which swaps the `--lab-*` set. This is the
 * proof for the "themes by swapping the variable set" criterion.
 */
import LabButton, { type LabButtonKind, type LabButtonType } from '../../output/react/src/button';

const TYPES: LabButtonType[] = ['accent', 'neutral', 'danger'];
const KINDS: LabButtonKind[] = ['fill', 'tinted', 'border', 'ghost'];

function ThemePanel({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <section
      data-theme={theme}
      data-testid={`panel-${theme}`}
      style={{
        background: 'var(--lab-surface-base)',
        color: 'var(--lab-label-primary)',
        padding: 'var(--lab-space-6)',
        display: 'grid',
        gap: 'var(--lab-space-4)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 'var(--lab-font-size-lg)' }}>{theme}</h2>

      {/* Type × Kind grid at size m */}
      {TYPES.map((type) => (
        <div key={type} style={{ display: 'flex', gap: 'var(--lab-space-3)', flexWrap: 'wrap' }}>
          {KINDS.map((kind) => (
            <LabButton key={`${type}-${kind}`} type={type} kind={kind} size="m">
              {type}/{kind}
            </LabButton>
          ))}
        </div>
      ))}

      {/* Sizes */}
      <div style={{ display: 'flex', gap: 'var(--lab-space-3)', alignItems: 'center' }}>
        <LabButton size="s">Small</LabButton>
        <LabButton size="m">Medium</LabButton>
        <LabButton size="l">Large</LabButton>
      </div>

      {/* States: loading, disabled, danger */}
      <div style={{ display: 'flex', gap: 'var(--lab-space-3)', alignItems: 'center' }}>
        <LabButton loading>Loading</LabButton>
        <LabButton disabled>Disabled</LabButton>
        <LabButton type="danger" kind="fill">
          Delete
        </LabButton>
        <LabButton type="neutral" kind="ghost" ariaLabel="icon only" />
      </div>
    </section>
  );
}

export function ButtonMatrix() {
  return (
    <main data-testid="matrix" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <ThemePanel theme="light" />
      <ThemePanel theme="dark" />
    </main>
  );
}
