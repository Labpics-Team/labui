#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflows = {
  ci: readFileSync('.github/workflows/ci.yml', 'utf8'),
  full: readFileSync('.github/workflows/e2e-full.yml', 'utf8'),
};

function artifactSteps(source) {
  const lines = source.split('\n');
  const steps = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('      - name: ')) continue;
    const block = [lines[i]];
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('      - name: ')) block.push(lines[j++]);
    if (!block.some((line) => line.includes('uses: actions/upload-artifact@'))) continue;
    const condition =
      block
        .find((line) => line.trim().startsWith('if:'))
        ?.trim()
        .slice(3)
        .trim() ?? '';
    steps.push({ name: lines[i].slice('      - name: '.length), condition });
  }
  const uploadCount = (source.match(/actions\/upload-artifact@/g) ?? []).length;
  if (uploadCount !== steps.length) {
    throw new Error('Every artifact upload must have its own named step and retention contract');
  }
  return steps;
}

const actual = {
  ci: artifactSteps(workflows.ci),
  full: artifactSteps(workflows.full),
};

const expected = {
  ci: [
    {
      name: 'Upload Trivy report',
      condition: "${{ failure() && steps.dbwarm.outputs.ready == 'true' }}",
    },
    {
      name: 'Upload FX-render артефакт (PNG для обзора владельцем)',
      condition: "${{ !cancelled() && steps.browser.outputs.fx_ready == 'true' }}",
    },
    {
      name: 'Upload Playwright report',
      condition: "${{ failure() && steps.browser.outputs.report_ready == 'true' }}",
    },
  ],
  full: [
    {
      name: 'Upload Playwright report',
      condition: '${{ failure() }}',
    },
  ],
};

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(
    'CI artifact retention drift: diagnostics must remain failure-only; explicit owner-review artifacts require an intentional contract update',
  );
}

process.stdout.write('CI artifact retention contract: PASS\n');
