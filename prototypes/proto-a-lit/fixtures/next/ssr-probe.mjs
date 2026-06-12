// Criterion 1 evidence for Next 15: starts the production server, fetches the
// page, and asserts the server HTML already contains the Button's DECLARATIVE
// SHADOW DOM (<template shadowrootmode="open">) — i.e. it was server-rendered,
// not blank-then-hydrated. A blank shell here would mean FOUC.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4401;
const server = spawn('pnpm', ['run', 'start'], {
  stdio: ['ignore', 'pipe', 'inherit'],
  shell: true,
});

let ready = false;
server.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (/Ready|started server|Local:/i.test(String(chunk))) ready = true;
});

async function waitReady(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ready) return;
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error('Next server did not become ready');
}

try {
  await waitReady();
  const html = await (await fetch(`http://127.0.0.1:${PORT}/`)).text();

  const hasTag = html.includes('<lab-button');
  const hasDeclarativeShadow = /shadowrootmode=/.test(html);
  const hasInnerButton = /<template[^>]*shadowrootmode[\s\S]*?<button/.test(html);

  process.stdout.write('\n--- Next 15 SSR probe ---\n');
  process.stdout.write(`  <lab-button> in server HTML:       ${hasTag}\n`);
  process.stdout.write(`  declarative shadow DOM present:    ${hasDeclarativeShadow}\n`);
  process.stdout.write(`  inner <button> inside the shadow:  ${hasInnerButton}\n`);

  const pass = hasTag && hasDeclarativeShadow && hasInnerButton;
  process.stdout.write(`  RESULT: ${pass ? 'PASS (deep SSR, no FOUC)' : 'FAIL'}\n`);
  process.exitCode = pass ? 0 : 1;
} finally {
  server.kill();
}
