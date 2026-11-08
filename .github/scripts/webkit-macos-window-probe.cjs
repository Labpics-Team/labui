const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const runtime = createRequire(path.join(process.env.PW_PROBE_RUNTIME, 'package.json'));
const { webkit } = runtime('playwright');
const { PNG } = runtime('pngjs');
const { WIDTH, HEIGHT, SIZE, MARKERS, STATE, analyze } = require('./webkit-display-capture.cjs');
const evidence = process.env.PW_PROBE_EVIDENCE;
const IDENTITIES = [
  [120, 30, 210],
  [250, 128, 20],
];
const result = {
  version: runtime('playwright/package.json').version,
  sourceSha: process.env.GITHUB_SHA,
  runId: process.env.GITHUB_RUN_ID,
  platform: process.platform,
  method: 'Playwright.takePageScreenshot and screencapture -l windowID',
  rounds: [],
};
const servers = [];
let captureUnavailable;

function crop(image, rect) {
  if (
    ![rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > image.width ||
    rect.y + rect.height > image.height
  )
    throw new Error('Window extends outside captured display');
  const target = new PNG({ width: rect.width, height: rect.height });
  for (let y = 0; y < rect.height; y++)
    image.data.copy(
      target.data,
      y * rect.width * 4,
      ((rect.y + y) * image.width + rect.x) * 4,
      ((rect.y + y) * image.width + rect.x + rect.width) * 4,
    );
  return target;
}

function inspect(file, worker, filter, rect) {
  let image = PNG.sync.read(fs.readFileSync(file));
  if (rect) image = crop(image, rect);
  const analysis = analyze(image, filter);
  if (analysis.valid) {
    const x = Math.round(analysis.origin.x + 588 * analysis.sx);
    const y = Math.round(analysis.origin.y + 240 * analysis.sy);
    const identity = [0, 1, 2].map((channel) => image.data[(y * image.width + x) * 4 + channel]);
    const identityMatches = identity.every(
      (value, channel) => Math.abs(value - IDENTITIES[worker][channel]) < 20,
    );
    if (!identityMatches)
      return {
        ...analysis,
        valid: false,
        reason: 'Wrong worker window identity',
        identity,
        worker,
      };
    fs.writeFileSync(
      file.replace(/\.png$/, `-worker${worker}-roi.png`),
      PNG.sync.write(crop(image, analysis.rect)),
    );
  }
  return { file: path.basename(file), worker, ...analysis };
}

function capture(file, args = []) {
  if (captureUnavailable)
    throw new Error('Capture unavailable after previous screencapture failure');
  try {
    execFileSync('/usr/sbin/screencapture', ['-x', ...args, file], {
      timeout: 20000,
      stdio: 'pipe',
    });
  } catch (error) {
    captureUnavailable = {
      message: error.message,
      status: error.status,
      stderr: error.stderr?.toString(),
    };
    throw error;
  }
}

function windowRows(pid) {
  return JSON.parse(
    execFileSync(path.join(evidence, 'window-list'), pid ? [String(pid)] : [], {
      timeout: 10000,
      encoding: 'utf8',
    }),
  );
}

function processRows() {
  return execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,comm='], { encoding: 'utf8', timeout: 10000 })
    .trim()
    .split('\n')
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
      if (!match) throw new Error(`Unrecognized process row: ${line}`);
      return { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] };
    });
}

function windowFor(rows, pid, processes) {
  const descendants = new Set([pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const process of processes)
      if (descendants.has(process.ppid) && !descendants.has(process.pid)) {
        descendants.add(process.pid);
        changed = true;
      }
  }
  const matches = rows.filter(
    (row) =>
      descendants.has(row.pid) &&
      row.layer === 0 &&
      row.bounds.Width >= WIDTH &&
      row.bounds.Height >= HEIGHT &&
      row.onscreen,
  );
  if (matches.length !== 1)
    throw new Error(
      `Expected one visible window for browser PID ${pid}; got ${JSON.stringify(matches)}`,
    );
  return matches[0];
}

function html(worker) {
  return `<!doctype html><style>body{margin:0}#background{position:fixed;inset:0;background:repeating-linear-gradient(90deg,rgb(216 40 100) 0 8px,rgb(24 180 212) 8px 16px)}#surface{position:absolute;left:96px;top:96px;width:384px;height:240px;background:rgb(255 255 255 / .2)}.marker{position:fixed;width:${SIZE}px;height:${SIZE}px;z-index:10}</style><div id="background"></div><div id="surface"></div>${MARKERS.map((marker) => `<div class="marker" style="left:${marker.x}px;top:${marker.y}px;background:rgb(${marker.rgb.join(' ')})"></div>`).join('')}<div id="state" class="marker" style="left:${STATE.x}px;top:${STATE.y}px"></div><div class="marker" style="left:580px;top:232px;background:rgb(${IDENTITIES[worker].join(' ')})"></div>`;
}

(async () => {
  const workers = [];
  try {
    for (let worker = 0; worker < 2; worker++) {
      const server = await webkit.launchServer({ headless: false });
      servers.push(server);
      const browser = await webkit.connect(server.wsEndpoint());
      workers.push({ worker, browser, pid: server.process().pid });
    }
    for (const deviceScaleFactor of [1, 2]) {
      try {
        for (const item of workers) {
          item.context = await item.browser.newContext({
            viewport: { width: WIDTH, height: HEIGHT },
            deviceScaleFactor,
          });
          item.page = await item.context.newPage();
          await item.page.setContent(html(item.worker));
        }
        for (let round = 0; round < 4; round++) {
          const filters = round % 2 ? ['none', 'blur(48px)'] : ['blur(48px)', 'none'];
          await Promise.all(
            workers.map(async (item, worker) => {
              await item.page.evaluate(
                ({ filter, color }) => {
                  const surface = document.getElementById('surface');
                  surface.style.setProperty('backdrop-filter', filter);
                  surface.style.setProperty('-webkit-backdrop-filter', filter);
                  document.getElementById('state').style.backgroundColor =
                    `rgb(${color.join(' ')})`;
                },
                {
                  filter: filters[worker],
                  color: filters[worker] === 'none' ? STATE.off : STATE.on,
                },
              );
              await item.page.evaluate(
                () =>
                  new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve)),
                  ),
              );
            }),
          );
          const requestedFocus = Math.floor(round / 2);
          await workers[requestedFocus].page.bringToFront();
          const processes = processRows();
          const beforeFocus = windowRows();
          const ownedWindows = workers.map((item) => windowFor(beforeFocus, item.pid, processes));
          fs.writeFileSync(
            path.join(evidence, `dpr${deviceScaleFactor}-round${round}-ownership.json`),
            JSON.stringify(
              {
                workers: workers.map((item) => ({ worker: item.worker, launcherPid: item.pid })),
                windows: ownedWindows,
                processes,
              },
              null,
              2,
            ),
          );
          const rows = windowRows(ownedWindows[requestedFocus].pid);
          const windows = workers.map((item) => windowFor(rows, item.pid, processes));
          const frontWorker = windows[0].order < windows[1].order ? 0 : 1;
          const prefix = `dpr${deviceScaleFactor}-round${round}`;
          const displayFile = path.join(evidence, `${prefix}-display.png`);
          capture(displayFile);
          const bounds = windows[frontWorker].bounds;
          const display = inspect(displayFile, frontWorker, filters[frontWorker], {
            x: bounds.X,
            y: bounds.Y,
            width: bounds.Width,
            height: bounds.Height,
          });
          const captures = await Promise.all(
            workers.map(async (item, worker) => {
              const pngFile = path.join(evidence, `${prefix}-worker${worker}-upstream-window.png`);
              await item.page.screenshot({ path: pngFile, scale: 'css', timeout: 10000 });
              const upstream = inspect(pngFile, worker, filters[worker]);
              const osFile = path.join(
                evidence,
                `${prefix}-worker${worker}-screencapture-window.png`,
              );
              capture(osFile, ['-l', String(windows[worker].id), '-o']);
              const osWindow = inspect(osFile, worker, filters[worker]);
              const geometry = await item.page.evaluate(() => ({
                screenX,
                screenY,
                outerWidth,
                outerHeight,
                innerWidth,
                innerHeight,
                devicePixelRatio,
                visibility: document.visibilityState,
                focused: document.hasFocus(),
                standard: getComputedStyle(document.getElementById('surface')).backdropFilter,
              }));
              return {
                worker,
                pid: item.pid,
                filter: filters[worker],
                window: windows[worker],
                geometry,
                upstream,
                osWindow,
              };
            }),
          );
          const focusMatches =
            frontWorker === requestedFocus &&
            windows[frontWorker].frontmostPid === windows[requestedFocus].pid;
          const valid =
            focusMatches &&
            display.valid &&
            captures.every((item) => item.upstream.valid && item.osWindow.valid);
          const correct = (item) =>
            item.valid && (filters[item.worker] === 'none' ? item.signal > 8 : item.signal < 3);
          const pass =
            valid &&
            correct(display) &&
            captures.every((item) => correct(item.upstream) && correct(item.osWindow));
          result.rounds.push({
            deviceScaleFactor,
            round,
            requestedFocus,
            frontWorker,
            focusMatches,
            windows,
            display,
            captures,
            valid,
            pass,
          });
          console.info(
            JSON.stringify({
              deviceScaleFactor,
              round,
              requestedFocus,
              frontWorker,
              valid,
              pass,
              signals: captures.map((item) => ({
                worker: item.worker,
                filter: item.filter,
                upstream: item.upstream.signal,
                osWindow: item.osWindow.signal,
              })),
            }),
          );
        }
      } finally {
        for (const item of workers) if (item.context) await item.context.close();
      }
    }
  } finally {
    for (const server of servers) await server.close();
  }
  result.pairs = [];
  for (const deviceScaleFactor of [1, 2])
    for (const worker of [0, 1])
      for (const method of ['upstream', 'osWindow']) {
        const captures = result.rounds
          .filter((round) => round.deviceScaleFactor === deviceScaleFactor)
          .map((round) => round.captures[worker]);
        const on = captures
          .filter((item) => item.filter !== 'none')
          .map((item) => item[method].signal);
        const off = captures
          .filter((item) => item.filter === 'none')
          .map((item) => item[method].signal);
        const pass =
          on.length === 2 &&
          off.length === 2 &&
          Math.max(...on) < 3 &&
          Math.min(...off) > 8 &&
          Math.max(...on) < Math.min(...off) * 0.2;
        result.pairs.push({ deviceScaleFactor, worker, method, on, off, pass });
      }
  result.pass =
    result.rounds.length === 8 &&
    result.rounds.every((round) => round.pass) &&
    result.pairs.every((pair) => pair.pass);
  if (!result.pass) process.exitCode = 1;
})()
  .catch((error) => {
    result.error = error.stack ?? String(error);
    result.captureUnavailable = captureUnavailable;
    process.exitCode = 1;
  })
  .finally(() => {
    fs.writeFileSync(path.join(evidence, 'window-result.json'), JSON.stringify(result, null, 2));
    console.info(JSON.stringify(result));
  });
