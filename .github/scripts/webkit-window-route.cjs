const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const packageRoot = path.join(process.env.PW_PROBE_RUNTIME, 'node_modules/playwright-core');
if (JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'))).version !== '1.65.0')
  throw new Error('Diagnostic route is pinned to Playwright 1.65.0');
const file = path.join(packageRoot, 'lib/coreBundle.js');
const before = fs.readFileSync(file, 'utf8');
const from =
  'const result2 = await progress2.race(this._session.send("Page.snapshotRect", { ...rect, coordinateSystem: documentRect ? "Page" : "Viewport", omitDeviceScaleFactor, format: recodePngToWebp ? "png" : format2, quality: recodePngToWebp ? void 0 : quality }));';
if (before.split(from).length !== 2)
  throw new Error('Expected exactly one upstream WebKit screenshot call');
const to =
  'if (process.platform !== "darwin" || format2 !== "png" || documentRect) throw new Error("Diagnostic window route only supports macOS viewport PNG");\n        const result2 = await progress2.race(this._pageProxySession.connection.browserSession.send("Playwright.takePageScreenshot", { pageProxyId: this._pageProxySession.sessionId, ...rect, omitDeviceScaleFactor }));';
const after = before.replace(from, to);
fs.writeFileSync(file, after);
fs.writeFileSync(
  path.join(process.env.PW_PROBE_EVIDENCE, 'runtime-route.json'),
  JSON.stringify(
    {
      version: '1.65.0',
      from,
      to,
      beforeSha256: crypto.createHash('sha256').update(before).digest('hex'),
      afterSha256: crypto.createHash('sha256').update(after).digest('hex'),
    },
    null,
    2,
  ),
);
