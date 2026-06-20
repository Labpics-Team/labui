// Zero-dependency static server for the Liquid Glass playground.
//   node serve.mjs        → http://127.0.0.1:4477
//   node serve.mjs 5000   → custom port
// (A server is needed because the playground is an ES module that fetches the
//  displacement assets — file:// blocks both.)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 4477);
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    // Containment: resolve against ROOT and reject anything that escapes it
    // (../, encoded backslash, absolute/UNC, null byte). Path-only, no traversal.
    const full = resolve(ROOT, `.${p.startsWith('/') ? p : `/${p}`}`);
    if (full !== ROOT && !full.startsWith(ROOT + sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const data = await readFile(full);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(full)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`Liquid Glass playground → http://127.0.0.1:${PORT}\n`);
});
