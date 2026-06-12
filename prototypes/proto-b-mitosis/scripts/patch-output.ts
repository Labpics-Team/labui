/**
 * Post-compile PATCH layer — and, more importantly, the MEASUREMENT of how much
 * hand-work the Mitosis "write once" promise actually costs per target.
 *
 * Every entry here is an edit the generated code needs before it compiles or
 * runs correctly. The count and nature of these patches is a primary FINDINGS
 * data point: a true write-once tool needs zero. We log each applied patch so
 * the cost is auditable, not hidden.
 *
 * Run: `pnpm tsx ./scripts/patch-output.ts`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Patch {
  file: string;
  why: string;
  apply: (src: string) => string;
}

const root = resolve(import.meta.dirname, '..');

const patches: Patch[] = [
  {
    file: 'output/react/src/button.tsx',
    why: 'React passes a SYNTHETIC event; the source DOM `MouseEvent` type does not translate. Mitosis has no portable event type, so the React target must be retyped to React.MouseEvent.',
    apply: (src) =>
      src
        .replace(
          'onClick?: (event: MouseEvent) => void;',
          'onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;',
        )
        .replace(
          'const handleClick = function handleClick(event: MouseEvent) {',
          'const handleClick = function handleClick(event: React.MouseEvent<HTMLButtonElement>) {',
        ),
  },
  {
    file: 'output/react/src/button.tsx',
    why: 'Mitosis injects a dead `const Shows = null;` from the <Show> import. `noUnusedLocals` rejects it; it is pure dead code.',
    apply: (src) => src.replace(/\n\s*const Shows = null;\n/, '\n'),
  },
  {
    file: 'output/react/src/button.tsx',
    why: 'Mitosis has no portable children node type, so the source types children as `unknown`. The React target must widen it to React.ReactNode or {props.children} fails strict typecheck.',
    apply: (src) => src.replace('children?: unknown;', 'children?: React.ReactNode;'),
  },
];

let applied = 0;
const log: string[] = [];
for (const patch of patches) {
  const path = resolve(root, patch.file);
  const before = readFileSync(path, 'utf8');
  const after = patch.apply(before);
  if (after === before) {
    log.push(`SKIP (already clean / pattern not found): ${patch.file} — ${patch.why}`);
    continue;
  }
  writeFileSync(path, after, 'utf8');
  applied += 1;
  log.push(`PATCHED: ${patch.file} — ${patch.why}`);
}

for (const line of log) process.stdout.write(`${line}\n`);
process.stdout.write(`\nTotal manual patches applied: ${applied} of ${patches.length}\n`);
