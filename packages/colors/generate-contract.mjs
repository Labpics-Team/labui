import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { initializeNodeColors } from './engine.mjs';
import { themeProfile } from './profile.mjs';
import { createThemeProgram } from './program.mjs';

export const RETIRED_ROLES = new Set([
  '--lab-fx-shadow-minor',
  '--lab-fx-shadow-ambient',
  '--lab-fx-shadow-penumbra',
  '--lab-fx-shadow-major',
]);

export async function generateContract() {
  await initializeNodeColors();
  const body = (theme, contrast = 'normal') => {
    const program = createThemeProgram(theme, contrast);
    try {
      return Object.entries(program.update())
        .map(([name, value]) => `  ${name}: ${value};`)
        .join('\n');
    } finally {
      program.dispose();
    }
  };
  const light = body('light');
  const dark = body('dark');
  const moreLight = body('light', 'more');
  const moreDark = body('dark', 'more');
  return `/* Generated from labui.config.json through @labpics/colors Program API.
   Run pnpm --filter @labui/colors generate. The same profile drives runtime scopes. */
:root,
[data-theme="light"] {
${light}
}
[data-theme="dark"] {
${dark}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-theme="dark"]) {
${dark}
  }
}
:root[data-contrast="more"],
[data-theme="light"][data-contrast="more"] {
${moreLight}
}
[data-theme="dark"][data-contrast="more"] {
${moreDark}
}
@media (prefers-color-scheme: dark) {
  :root[data-contrast="more"]:not([data-theme="light"]):not([data-theme="dark"]) {
${moreDark}
  }
}
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(new URL('./contract.css', import.meta.url), await generateContract());
  const path = new URL('./roles.json', import.meta.url);
  const taxonomy = JSON.parse(await readFile(path, 'utf8'));
  const existing = new Set(
    Object.entries(taxonomy.groups)
      .filter(([name]) => name !== 'AuthoredBadge')
      .flatMap(([, roles]) => roles),
  );
  taxonomy.groups.AuthoredBadge = Object.keys(themeProfile().roles)
    .filter((role) => role.startsWith('badge-'))
    .map((role) => `--lab-${role}`)
    .filter((role) => !existing.has(role));
  await writeFile(path, `${JSON.stringify(taxonomy, null, 2)}\n`);
}
