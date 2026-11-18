import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { load } from 'js-yaml';

const workflow = load(
  readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'),
);
const workers = ['quality', 'e2e', 'security'];

test('PR checks stay independent when an older attempt joins after the current one', () => {
  const event = (event_name, run_id, run_attempt, ref, number = 0) => ({
    workflow: workflow.name,
    event_name,
    run_id,
    run_attempt,
    ref,
    event: { pull_request: { number } },
  });
  const pr = (run, attempt = 1) => event('pull_request', run, attempt, 'refs/pull/8/merge', 8);
  const render = (value, github) =>
    String(value)
      .replace(/\$\{\{(.*?)\}\}/g, (_, expression) =>
        runInNewContext(
          expression,
          {
            github,
            format: (pattern, ...args) =>
              pattern.replace(/\{(\d+)\}/g, (_, place) => args[Number(place)]),
          },
          { timeout: 100 },
        ),
      )
      .toLowerCase();
  const consumer = load(
    readFileSync(new URL('../../.github/workflows/icons-consumer.yml', import.meta.url), 'utf8'),
  );
  const scopes = [workflow, consumer];
  const policies = scopes
    .flatMap((scope) => [scope, ...Object.values(scope.jobs)])
    .map((owner) => owner.concurrency)
    .filter(Boolean);
  for (const order of [
    [pr(1), pr(2), pr(1, 2)],
    [pr(2), pr(1, 2), pr(1)],
  ]) {
    const busy = new Set();
    for (const run of order) {
      for (const key of new Set(policies.map((policy) => render(policy.group, run)))) {
        assert(!busy.has(key), key);
        busy.add(key);
      }
    }
  }
  for (const { concurrency } of scopes) {
    for (const [name, ref] of [
      ['push', 'refs/heads/main'],
      ['merge_group', 'refs/heads/gh-readonly-queue/main/pr-8'],
    ]) {
      assert.equal(
        render(concurrency.group, event(name, 1, 1, ref)),
        render(concurrency.group, event(name, 2, 1, ref)),
      );
      assert.equal(render(concurrency['cancel-in-progress'], event(name, 1, 1, ref)), 'true');
    }
  }
});

test('CI reports every required result when a PR check is cancelled', () => {
  const gate = workflow.jobs.ci;
  assert.equal(gate.name, 'CI');
  assert.equal(gate.if, '${{ always() }}');
  assert.equal(gate.concurrency, undefined);
  assert.deepEqual(new Set(gate.needs), new Set(workers));
  const step = gate.steps.find((item) => item.env?.NEEDS_RESULTS);
  assert.equal(step.env.NEEDS_RESULTS, "${{ join(needs.*.result, ',') }}");
  for (const worker of workers) {
    for (const status of ['success', 'cancelled', 'skipped', 'failure']) {
      const results = gate.needs.map((name) => (name === worker ? status : 'success'));
      const run = spawnSync(step.shell, ['-c', step.run], {
        env: { ...process.env, NEEDS_RESULTS: results.join(',') },
      });
      assert.equal(run.error, undefined);
      assert.equal(run.status === 0, status === 'success', `${worker}/${status}`);
    }
  }
});
