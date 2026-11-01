import { execFileSync } from 'node:child_process';
import {
  closeSync,
  openSync,
  readSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { basename, join } from 'node:path';

export const GIT_DEADLINE_MS = 20_000;
export const GIT_TRACE_MAX_BYTES = 256 * 1024;
const EVENT_LIMIT = 24;
const PROCESS_LIMIT = 16;
const REGION_LIMIT = 16;
const REGIONS = new Set([
  'index/do_read_index',
  'index/preload',
  'index/refresh',
  'index/do_write_index',
  'cache_tree/read',
  'cache_tree/write',
  'status/worktrees',
  'status/index',
  'status/untracked',
  'status/print',
  'diff/setup',
  'diff/write back to queue',
  'diff/exact',
  'diff/inexact',
  'fsmonitor/query',
  'fsmonitor/apply_results',
]);
const COMMANDS = new Set([
  'status',
  'rev-parse',
  'show',
  'fetch',
  'index-pack',
  'fetch-pack',
  'upload-pack',
]);
const COUNTERS = new Set([
  'refresh/sum_lstat',
  'refresh/sum_scan',
  'preload/sum_lstat',
  'read/cache_nr',
  'write/cache_nr',
]);
const finite = (value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

export function summarizeGitTrace(bytes, inputTruncated = bytes.length > GIT_TRACE_MAX_BYTES) {
  let truncated = inputTruncated;
  const events = [];
  const processes = new Map();
  const openRegions = [];
  let gitVersion = null;
  let invalidLines = 0;
  let droppedEvents = 0;
  for (const line of bytes.subarray(0, GIT_TRACE_MAX_BYTES).toString('utf8').split('\n')) {
    if (!line) continue;
    let source;
    try {
      source = JSON.parse(line);
    } catch {
      invalidLines++;
      continue;
    }
    if (!source || typeof source !== 'object') {
      invalidLines++;
      continue;
    }
    if (
      gitVersion === null &&
      source.event === 'version' &&
      typeof source.exe === 'string' &&
      source.exe.length <= 64 &&
      /^\d+\.\d+\.\d+(?:[.-][A-Za-z0-9]+)*$/.test(source.exe)
    )
      gitVersion = source.exe;
    if (
      typeof source.sid !== 'string' ||
      source.sid.length > 256 ||
      typeof source.thread !== 'string' ||
      source.thread.length > 32
    )
      continue;
    const identity = `${source.sid}\0${source.thread}`;
    if (!processes.has(identity)) {
      if (processes.size >= PROCESS_LIMIT) {
        truncated = true;
        continue;
      }
      processes.set(identity, processes.size + 1);
    }
    const process = processes.get(identity);
    const event = { event: source.event, process };
    if (finite(source.t_abs)) event.elapsedSeconds = source.t_abs;
    if (['region_enter', 'region_leave'].includes(source.event)) {
      if (!REGIONS.has(`${source.category}/${source.label}`) || !finite(source.nesting)) continue;
      Object.assign(event, {
        category: source.category,
        label: source.label,
        nesting: source.nesting,
      });
      if (source.event === 'region_enter') {
        if (openRegions.length >= REGION_LIMIT) {
          openRegions.shift();
          truncated = true;
        }
        openRegions.push(event);
      } else {
        const index = openRegions.findLastIndex(
          (entry) =>
            entry.process === process &&
            entry.category === event.category &&
            entry.label === event.label &&
            entry.nesting === event.nesting,
        );
        if (index !== -1) openRegions.splice(index, 1);
        if (finite(source.t_rel)) event.durationSeconds = source.t_rel;
      }
    } else if (
      source.event === 'data' &&
      source.category === 'index' &&
      COUNTERS.has(source.key) &&
      finite(Number(source.value))
    ) {
      Object.assign(event, { counter: source.key, value: Number(source.value) });
    } else if (source.event === 'cmd_name' && COMMANDS.has(source.name)) {
      event.command = source.name;
    } else if (['child_start', 'child_exit'].includes(source.event) && finite(source.child_id)) {
      event.child = source.child_id;
      if (Number.isSafeInteger(source.code)) event.code = source.code;
    } else if (source.event === 'exit' && Number.isSafeInteger(source.code)) {
      event.code = source.code;
    } else continue;
    events.push(event);
    if (events.length > EVENT_LIMIT) {
      events.shift();
      droppedEvents++;
    }
  }
  return {
    gitVersion,
    traceComplete: gitVersion !== null && !truncated && invalidLines === 0,
    truncated,
    invalidLines,
    droppedEvents,
    events,
    openRegions,
  };
}

function readTrace(path) {
  const bytes = Buffer.alloc(Math.min(statSync(path).size, GIT_TRACE_MAX_BYTES));
  const fd = openSync(path, 'r');
  let read = 0;
  try {
    while (read < bytes.length) {
      const count = readSync(fd, bytes, read, bytes.length - read, read);
      if (count === 0) break;
      read += count;
    }
  } finally {
    closeSync(fd);
  }
  return summarizeGitTrace(bytes.subarray(0, read), statSync(path).size > GIT_TRACE_MAX_BYTES);
}

// Диагностика подготовки входов: убрать после установления причины run 41344458682.
// Raw Trace2 не публикуется: argv, окружение и конфигурация не входят в проекцию.
export function createGitRunner(
  directory,
  execute = execFileSync,
  emit = (line) => writeSync(2, line),
) {
  const publish = (line) => {
    try {
      emit(line);
    } catch {
      /* Закрытый stderr не меняет исход Git. */
    }
  };
  return (root, args) => {
    const options = { cwd: root, timeout: GIT_DEADLINE_MS };
    if (!directory) return execute('git', ['--no-replace-objects', ...args], options);
    const raw = join(directory, '.git-trace2.raw');
    writeFileSync(raw, '', { flag: 'wx', mode: 0o600 });
    options.env = {
      ...process.env,
      GIT_TRACE2: '',
      GIT_TRACE2_PERF: '',
      GIT_TRACE2_EVENT: raw,
      GIT_TRACE2_ENV_VARS: '',
      GIT_TRACE2_CONFIG_PARAMS: '',
    };
    let result;
    let failure;
    try {
      result = execute('git', ['--no-replace-objects', ...args], options);
    } catch (error) {
      failure = error;
    }
    try {
      const report = {
        schemaVersion: 1,
        source: basename(root) === 'icons' ? 'icons' : basename(root) === 'source' ? 'ui' : 'other',
        operation: COMMANDS.has(args[0]) ? args[0] : 'other',
        deadlineMs: GIT_DEADLINE_MS,
        outcome: failure ? 'failed' : 'passed',
        error: failure
          ? ['ETIMEDOUT', 'ENOENT', 'ENOBUFS'].includes(failure.code)
            ? failure.code
            : 'other'
          : null,
        exitStatus:
          failure && Number.isSafeInteger(failure.status) ? failure.status : failure ? null : 0,
        signal:
          failure && ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT', 'SIGSEGV'].includes(failure.signal)
            ? failure.signal
            : null,
        ...readTrace(raw),
      };
      const line = `${JSON.stringify(report)}\n`;
      writeFileSync(join(directory, 'git-diagnostics.json'), line, { mode: 0o600 });
      if (failure) publish(`LABUI_ICONS_GIT_DIAGNOSTIC ${line}`);
    } catch {
      publish('LABUI_ICONS_GIT_DIAGNOSTIC {"outcome":"incomplete"}\n');
    } finally {
      try {
        unlinkSync(raw);
      } catch {
        publish('LABUI_ICONS_GIT_DIAGNOSTIC {"outcome":"incomplete","rawCleanup":"failed"}\n');
      }
    }
    if (failure) throw failure;
    return result;
  };
}
