#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const workflows = {
  ci: readFileSync('.github/workflows/ci.yml', 'utf8'),
  full: readFileSync('.github/workflows/e2e-full.yml', 'utf8'),
};

function artifactSteps(source) {
  const { parseAllDocuments } = createRequire(new URL('../../package.json', import.meta.url))(
    'yaml',
  );
  const documents = parseAllDocuments(source, { uniqueKeys: true, strict: true, version: '1.2' });
  if (documents.length !== 1 || documents[0].errors.length > 0) {
    throw new Error('Artifact retention requires one valid workflow document');
  }
  const workflow = documents[0].toJS({ maxAliasCount: 100 });
  const uploads = Object.values(workflow.jobs)
    .flatMap((job) => job.steps ?? [])
    .filter((step) => step.uses?.startsWith('actions/upload-artifact@'));
  if (uploads.some((step) => typeof step.name !== 'string')) {
    throw new Error('Every artifact upload must have its own named step and retention contract');
  }
  return uploads.map((step) => ({
    name: step.name,
    condition: step.if ?? '',
    nonAuthoritative: step['continue-on-error'] === true,
  }));
}

const actual = {
  ci: artifactSteps(workflows.ci),
  full: artifactSteps(workflows.full),
};

const expected = {
  ci: [
    {
      name: 'Upload FX-render артефакт (PNG для обзора владельцем)',
      condition: "${{ !cancelled() && steps.browser.outputs.fx_ready == 'true' }}",
      nonAuthoritative: true,
    },
    {
      name: 'Upload Playwright report',
      condition: "${{ failure() && steps.browser.outputs.report_ready == 'true' }}",
      nonAuthoritative: true,
    },
  ],
  full: [
    {
      name: 'Upload Playwright report',
      condition: "${{ failure() && steps.browser.outputs.report_ready == 'true' }}",
      nonAuthoritative: true,
    },
  ],
};

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(
    'CI artifact retention drift: diagnostics must remain failure-only; explicit owner-review artifacts require an intentional contract update',
  );
}

process.stdout.write('CI artifact retention contract: PASS\n');
