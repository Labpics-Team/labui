/**
 * Build + start the Next fixture for the Playwright webServer.
 * Resolves the Next bin from the sandbox node_modules (it is not in PATH).
 */
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'next');

// Build once (idempotent; reuses .next cache).
execFileSync(process.execPath, [nextBin, 'build'], { cwd: fixtureDir, stdio: 'inherit' });

// Start and stay in the foreground so Playwright owns the lifecycle.
const child = spawn(process.execPath, [nextBin, 'start', '-p', '4322'], {
  cwd: fixtureDir,
  stdio: 'inherit',
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('exit', (code) => process.exit(code ?? 0));
