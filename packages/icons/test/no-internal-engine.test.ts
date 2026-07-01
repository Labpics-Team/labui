import { describe, expect, it } from 'vitest';
import {
  type EngineViolation,
  FORBIDDEN_ENGINE_DEPS,
  scanManifest,
  scanPackageDir,
} from './no-internal-engine.js';

/**
 * Guards the North invariant (#3, zero-runtime-dep): `packages/icons` must
 * stay a THIN `@labpics/icons` stub bridge, never a copy of the real
 * `lab-icons` build/resolver engine. This is the RED-at-birth proof for the
 * icons-retire-legacy chapter — before this PR, `packages/icons` shipped its
 * own `src/index.ts` + `tsup.config.ts` build pipeline, which this exact
 * scanner would have flagged (see the synthetic proofs below).
 */
describe('no internal icon-build engine in packages/icons (live tree)', () => {
  it('the live packages/icons directory has ZERO engine violations', () => {
    const violations = scanPackageDir(process.cwd());
    const report = violations.map((v: EngineViolation) => `  ${v.kind}: ${v.detail}`).join('\n');
    expect(violations, `packages/icons must stay a thin stub bridge:\n${report}`).toEqual([]);
  });
});

describe('no-internal-engine scanner — detection proofs (RED-at-birth)', () => {
  it('DETECTS each forbidden build-tool dependency', () => {
    for (const dep of FORBIDDEN_ENGINE_DEPS) {
      const violations = scanManifest({ devDependencies: { [dep]: '1.0.0' } }, []);
      expect(violations.some((v) => v.kind === 'forbidden-dependency' && v.detail === dep)).toBe(
        true,
      );
    }
  });

  it('DETECTS a tsup/rollup/svgo config file sitting in the package', () => {
    expect(scanManifest({}, ['tsup.config.ts']).length).toBeGreaterThan(0);
    expect(scanManifest({}, ['rollup.config.mjs']).length).toBeGreaterThan(0);
    expect(scanManifest({}, ['svgo.config.js']).length).toBeGreaterThan(0);
  });

  it('DETECTS a build.js/ts codegen entry file', () => {
    expect(scanManifest({}, ['build.ts']).length).toBeGreaterThan(0);
    expect(scanManifest({}, ['build.js']).length).toBeGreaterThan(0);
  });

  it('DETECTS an icon-source or generator directory (src/scripts/assets)', () => {
    expect(scanManifest({}, ['src']).length).toBeGreaterThan(0);
    expect(scanManifest({}, ['scripts']).length).toBeGreaterThan(0);
    expect(scanManifest({}, ['assets']).length).toBeGreaterThan(0);
  });

  it('DETECTS a build script that shells out to a forbidden bundler', () => {
    const violations = scanManifest({ scripts: { build: 'tsup && node scripts/build.js' } }, []);
    expect(violations.some((v) => v.kind === 'forbidden-script')).toBe(true);
  });

  it('the exact pre-fix legacy manifest (tsup + src/) is flagged — proves this scanner would have caught it', () => {
    const legacyManifest = {
      devDependencies: { tsup: '8.3.6', typescript: '5.7.3' },
      scripts: { build: 'tsup', typecheck: 'tsc --noEmit' },
    };
    const legacyFiles = ['src', 'tsup.config.ts', 'tsconfig.json', 'package.json'];
    const violations = scanManifest(legacyManifest, legacyFiles);
    expect(violations.length).toBeGreaterThanOrEqual(3); // tsup dep + tsup.config.ts + src/
  });

  it('IGNORES a clean thin-bridge manifest (typescript + vitest only, no src/)', () => {
    const violations = scanManifest(
      {
        devDependencies: { typescript: '5.7.3', vitest: '2.1.8', '@types/node': '22.10.5' },
        scripts: { build: 'node -e "process.stdout.write(1)"', typecheck: 'tsc --noEmit' },
      },
      ['package.json', 'index.js', 'index.d.ts', 'README.md', 'test', 'tsconfig.json'],
    );
    expect(violations).toEqual([]);
  });
});
