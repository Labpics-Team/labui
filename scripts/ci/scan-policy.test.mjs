import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  BRACES,
  HTTP_CACHE,
} from '../../.github/actions/labpics-sca-policy/plans/tools/code-admission/reviewed-npm-patches.mjs';
import { decide, reportFindings } from './scan-policy.mjs';

function report(vulnerabilities = []) {
  return {
    SchemaVersion: 2,
    ArtifactName: resolve('/src'),
    ArtifactType: 'filesystem',
    Trivy: { Version: '0.74.0' },
    CreatedAt: new Date().toISOString(),
    Results: [
      {
        Target: 'pnpm-lock.yaml',
        Class: 'lang-pkgs',
        Type: 'pnpm',
        Packages: [{ Name: 'fixture', Version: '1' }],
        Vulnerabilities: vulnerabilities,
      },
    ],
  };
}
function vulnerability(spec, overrides = {}) {
  return {
    VulnerabilityID: spec.rules[0],
    PkgName: spec.name,
    InstalledVersion: spec.version,
    Severity: 'HIGH',
    ...overrides,
  };
}
function receipt(finding, spec) {
  return {
    fingerprint: finding.fingerprint,
    status: 'code-fixed',
    justification: 'vulnerable_code_fixed',
    patch: { sha256: spec.patchSha256, pnpmHash: spec.patchHash },
    advisory: { sha256: spec.advisorySha256 },
    native: {
      packageManager: spec.packageManager,
      inventory: { files: spec.inventoryFiles, sha256: spec.inventorySha256 },
    },
  };
}

test('decision removes only exact qualified fingerprints from the complete population', () => {
  const findings = reportFindings(
    report([vulnerability(BRACES), vulnerability(HTTP_CACHE)]),
    Date.now(),
  );
  const receipts = findings.map((finding, index) => receipt(finding, [BRACES, HTTP_CACHE][index]));
  assert.equal(decide(findings, receipts, []).valid, true);
  assert.equal(decide(findings, [], []).valid, false);
  const other = reportFindings(
    report([
      vulnerability(BRACES, {
        VulnerabilityID: 'CVE-OTHER-BLOCK',
        Severity: 'CRITICAL',
      }),
    ]),
    Date.now(),
  )[0];
  assert.equal(decide([...findings, other], receipts, []).valid, false);
  for (const changed of [
    { status: 'unqualified' },
    { status: 'not-affected' },
    { fingerprint: 'unrelated' },
    { native: {} },
    { patch: {} },
    { advisory: {} },
    { justification: 'ignored' },
  ])
    assert.throws(() => decide(findings, [{ ...receipts[0], ...changed }], []));
  const fixedUpstream = { ...findings[0], fixedVersion: '999' };
  assert.throws(() => decide([fixedUpstream], [receipts[0]], []));
  assert.equal(
    decide(findings, receipts, [{ kind: 'scanner-control', rule: 'inline-suppression' }]).valid,
    false,
  );
});

test('LOW secrets, UNKNOWN findings and suppressed misconfigurations still block', () => {
  const raw = report();
  raw.Results.push({
    Target: 'configuration.yaml',
    Class: 'config',
    Secrets: [{ Severity: 'LOW', RuleID: 'secret-rule', Match: 'do-not-print-this' }],
    Misconfigurations: [
      { Severity: 'LOW', ID: 'suppressed', Status: 'EXCEPTION', Title: 'hidden' },
      { Severity: 'UNKNOWN', ID: 'unknown', Status: 'FAIL', Title: 'unreviewed' },
    ],
  });
  const findings = reportFindings(raw, Date.now());
  assert.equal(decide(findings, [], []).blocking.length, 3);
  assert.equal(JSON.stringify(findings).includes('do-not-print-this'), false);
});

test('malformed, wrong-source, missing-inventory and stale reports cannot be clean', () => {
  for (const mutate of [
    (r) => {
      r.Results = undefined;
    },
    (r) => {
      r.ArtifactName = '/other';
    },
    (r) => {
      r.SchemaVersion = 1;
    },
    (r) => {
      r.Trivy.Version = '0.66.0';
    },
    (r) => {
      r.CreatedAt = '2000-01-01T00:00:00Z';
    },
    (r) => {
      r.Results[0].Packages = [];
    },
    (r) => {
      r.Results[0].Secrets = {};
    },
    (r) => {
      r.Results[0].Target = '../outside';
    },
    (r) => {
      r.Results[0].ExperimentalModifiedFindings = [{}];
    },
    (r) => {
      r.Results[0].Vulnerabilities = [vulnerability(BRACES, { Severity: 'NEW' })];
    },
    (r) => {
      r.Results[0].MisconfSummary = { Successes: 0, Failures: 1 };
    },
  ]) {
    const raw = report();
    mutate(raw);
    assert.throws(() => reportFindings(raw, Date.now()));
  }
});
