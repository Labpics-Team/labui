import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCarrier } from '../../.github/actions/labpics-sca-policy/verify.mjs';

const carrier = fileURLToPath(
  new URL('../../.github/actions/labpics-sca-policy/', import.meta.url),
);
verifyCarrier(carrier);
const { materializeSnapshot } = await import(
  '../../.github/actions/labpics-sca-policy/plans/tools/code-admission/snapshot.mjs'
);
const { normalizeTrivyReport, blockingSecurityFindings, databaseEvidence } = await import(
  '../../.github/actions/labpics-sca-policy/plans/tools/code-admission/trivy.mjs'
);
const { collectBypassFindings } = await import(
  '../../.github/actions/labpics-sca-policy/plans/tools/code-admission.mjs'
);
const { qualifyReviewedNpmFindings, BRACES, HTTP_CACHE } = await import(
  '../../.github/actions/labpics-sca-policy/plans/tools/code-admission/reviewed-npm-patches.mjs'
);

export function decide(findings, applicability, controls) {
  const qualified = new Set();
  for (const item of applicability) {
    const finding = findings.find((entry) => entry.fingerprint === item.fingerprint);
    const spec = [BRACES, HTTP_CACHE].find((entry) => entry.name === finding?.package);
    if (
      item.status !== 'code-fixed' ||
      item.justification !== 'vulnerable_code_fixed' ||
      !spec ||
      finding.kind !== 'vulnerability' ||
      finding.path !== 'pnpm-lock.yaml' ||
      finding.installedVersion !== spec.version ||
      finding.fixedVersion ||
      !spec.rules.includes(finding.rule) ||
      item.patch?.sha256 !== spec.patchSha256 ||
      item.patch?.pnpmHash !== spec.patchHash ||
      item.advisory?.sha256 !== spec.advisorySha256 ||
      item.native?.packageManager !== spec.packageManager ||
      item.native?.inventory?.files !== spec.inventoryFiles ||
      item.native?.inventory?.sha256 !== spec.inventorySha256
    )
      throw new Error('Patch qualification is incomplete or outside its reviewed scope');
    qualified.add(item.fingerprint);
  }
  const blocking = [
    ...blockingSecurityFindings(findings).filter((item) => !qualified.has(item.fingerprint)),
    ...controls,
  ];
  return { valid: blocking.length === 0, blocking, applicability };
}

export function reportFindings(report, started) {
  const timestamp = Date.parse(report.CreatedAt);
  if (
    !Number.isSafeInteger(started) ||
    report.Trivy?.Version !== '0.74.0' ||
    !Number.isFinite(timestamp) ||
    timestamp < started - 300_000 ||
    timestamp > Date.now() + 300_000
  )
    throw new Error('Trivy report lacks current pinned execution provenance');
  const findings = normalizeTrivyReport(report, '/src');
  if (
    !(report.Results ?? []).some(
      (result) =>
        result.Target === 'pnpm-lock.yaml' &&
        result.Class === 'lang-pkgs' &&
        result.Type === 'pnpm' &&
        result.Packages?.length > 0,
    )
  )
    throw new Error('Trivy report is missing the pnpm dependency inventory');
  return findings;
}

function regularJson(path) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size === 0 || info.size > 64 * 1024 * 1024)
    throw new Error('Missing or unqualified scanner evidence');
  const bytes = readFileSync(path);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('Scanner evidence is malformed JSON');
  }
  return { value, digest: createHash('sha256').update(bytes).digest('hex') };
}

async function main(argv) {
  if (argv.length === 2 && argv[0] === 'database') {
    console.info(JSON.stringify(databaseEvidence(argv[1])));
    return;
  }
  if (argv.length === 3 && argv[0] === 'snapshot') {
    const snapshot = materializeSnapshot(resolve(argv[1]), 'HEAD', resolve(argv[2]));
    if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== snapshot.commit)
      throw new Error('Native scanner subject does not match the workflow commit');
    console.info(JSON.stringify(snapshot));
    return;
  }
  if (argv.length !== 8 || argv[0] !== 'assess') throw new Error('Invalid scan-policy invocation');
  const [, reportPath, source, receiptPath, cache, databasePath, parent, output] = argv;
  const report = regularJson(reportPath);
  const snapshot = regularJson(receiptPath).value;
  if (
    !/^[a-f0-9]{40}$/.test(snapshot.commit) ||
    !/^[a-f0-9]{40}$/.test(snapshot.tree) ||
    !Number.isInteger(snapshot.files) ||
    snapshot.files < 1
  )
    throw new Error('Scanner snapshot receipt is invalid');
  const findings = reportFindings(report.value, Number(process.env.SCAN_STARTED_MS));
  const database = databaseEvidence(cache);
  if (JSON.stringify(database) !== JSON.stringify(regularJson(databasePath).value))
    throw new Error('Trivy database changed during the source scan');
  const configTargets = (report.value.Results ?? [])
    .filter((item) => item.Class === 'config')
    .map((item) => item.Target);
  const controls = collectBypassFindings(source, configTargets);
  const applicability = qualifyReviewedNpmFindings(source, findings, parent);
  const decision = decide(findings, applicability, controls);
  const evidence = {
    schema: 'labpics.native-sca/v1',
    ...decision,
    snapshot,
    reportDigest: report.digest,
    database,
    findings,
    scope: 'Immutable source and full reported finding population; no runtime image claim',
  };
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.info(
    JSON.stringify({
      schema: evidence.schema,
      valid: decision.valid,
      snapshot,
      findings: findings.length,
      blocking: decision.blocking.map(({ fingerprint, kind, severity, rule, path }) => ({
        fingerprint,
        kind,
        severity,
        rule,
        path,
      })),
      applicability,
      reportDigest: report.digest,
      database,
    }),
  );
  if (!decision.valid) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(
      Array.from(String(error.message), (character) =>
        character.codePointAt(0) < 32 || character.codePointAt(0) === 127 ? ' ' : character,
      ).join(''),
    );
    process.exitCode = 2;
  }
}
