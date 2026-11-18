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

test('PR checks can queue before the previous CI result finishes', () => {
  const event = (event_name, run_id, ref, number = 0) => ({
    workflow: workflow.name,
    event_name,
    run_id,
    ref,
    event: { pull_request: { number } },
  });
  const pr = (run, number = 8) => event('pull_request', run, `refs/pull/${number}/merge`, number);
  const render = (value, github) =>
    String(value)
      .replace(/\$\{\{(.*?)\}\}/g, (_, expression) =>
        runInNewContext(
          expression,
          { github, format: (text, arg) => text.replace('{0}', arg) },
          { timeout: 100 },
        ),
      )
      .toLowerCase();
  const root = workflow.concurrency;
  assert.notEqual(render(root.group, pr(1)), render(root.group, pr(2)));
  for (const [name, ref] of [
    ['push', 'refs/heads/main'],
    ['merge_group', 'refs/heads/gh-readonly-queue/main/pr-8'],
  ]) {
    assert.equal(render(root.group, event(name, 1, ref)), render(root.group, event(name, 2, ref)));
    assert.equal(render(root['cancel-in-progress'], event(name, 1, ref)), 'true');
  }
  const keys = workers.map((name) => {
    const policy = workflow.jobs[name].concurrency;
    const first = render(policy.group, pr(1));
    assert.equal(render(policy.group, pr(2)), first);
    assert.notEqual(render(policy.group, pr(3, 9)), first);
    assert.equal(render(policy['cancel-in-progress'], pr(2)), 'true');
    return first;
  });
  assert.equal(new Set(keys).size, workers.length);
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
