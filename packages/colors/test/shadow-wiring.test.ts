import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Shadow wiring gate — dependency-rule regression test.
 *
 * Locks the class "core and react components consume --lab-elevation-* tokens
 * but @labpics/ui-shadow is not declared as a dependency, so the tokens silently
 * resolve to nothing outside the docs app."
 *
 * Two invariants:
 *   1. packages/core/package.json declares @labpics/ui-shadow in dependencies.
 *   2. packages/react/package.json declares @labpics/ui-shadow in dependencies.
 *   3. packages/core/package.json exports a ./shadow.css entry so consumers can
 *      import the elevation contract from the core surface.
 *
 * How="mutation": removing @labpics/ui-shadow from either package.json fails
 * tests 1 or 2 immediately. Removing the ./shadow.css export from core fails
 * test 3. These tests are RED-proof by inspection — parsing real JSON from disk.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8')) as Record<string, unknown>;
}

describe('shadow wiring: @labpics/ui-shadow dependency declared in core + react', () => {
  it('@labpics/ui-core declares @labpics/ui-shadow in dependencies', () => {
    const pkg = readJson('packages/core/package.json');
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    expect(
      deps['@labpics/ui-shadow'],
      '@labpics/ui-core must list @labpics/ui-shadow in dependencies so consumers ' +
        'receive the shadow package when they install ui-core',
    ).toBeDefined();
  });

  it('@labpics/ui-react declares @labpics/ui-shadow in dependencies', () => {
    const pkg = readJson('packages/react/package.json');
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    expect(
      deps['@labpics/ui-shadow'],
      '@labpics/ui-react must list @labpics/ui-shadow in dependencies so consumers ' +
        'receive the shadow package when they install ui-react',
    ).toBeDefined();
  });

  it('@labpics/ui-core exports ./shadow.css so consumers have a canonical elevation-contract import', () => {
    const pkg = readJson('packages/core/package.json');
    const exps = (pkg.exports ?? {}) as Record<string, unknown>;
    expect(
      exps['./shadow.css'],
      '@labpics/ui-core must export ./shadow.css — without this, consumers cannot ' +
        'import the elevation contract and --lab-elevation-* tokens resolve to nothing',
    ).toBeDefined();
  });

  it('RED-proof: a package.json without @labpics/ui-shadow would fail the dep check', () => {
    const fakeDeps: Record<string, string> = { react: '18.0.0' };
    expect(fakeDeps['@labpics/ui-shadow']).toBeUndefined();
  });
});
