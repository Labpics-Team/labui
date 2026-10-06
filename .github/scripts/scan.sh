#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${TRIVY_IMAGE:?TRIVY_IMAGE is required}"
cache="${RUNNER_TEMP}/trivycache"
output="$(mktemp -d "${RUNNER_TEMP}/trivy-output.XXXXXX")"
trap 'rm -rf -- "$output"' EXIT
mkdir -p "$cache"
rm -f -- "${RUNNER_TEMP}/trivy-report.txt"
node scripts/ci/scan-policy.mjs snapshot "$PWD" "$output/source" > "$output/source.json"
printf '{}\n' > "$output/config.yaml"

ready=false
for attempt in 1 2 3 4 5; do
  if docker run --rm --user "$(id -u):$(id -g)" \
    -e TRIVY_DB_REPOSITORY -e TRIVY_JAVA_DB_REPOSITORY \
    -v "${cache}:/cache" "$TRIVY_IMAGE" \
    image --download-db-only --cache-dir /cache; then
    ready=true
    break
  fi
  if [ "$attempt" -lt 5 ]; then sleep "$((attempt * 10))"; fi
done
if [ "$ready" != true ]; then
  echo '::error::Trivy database unavailable; security verification did not run.' >&2
  exit 1
fi
node scripts/ci/scan-policy.mjs database "$cache" > "$output/database.json"
export SCAN_STARTED_MS="$(node -e 'process.stdout.write(String(Date.now()))')"

status=0
docker run --rm --user "$(id -u):$(id -g)" \
  -v "${output}/source:/src:ro" -v "${cache}:/cache" -v "${output}:/out" \
  "$TRIVY_IMAGE" fs /src \
  --config /out/config.yaml --secret-config /out/config.yaml --ignorefile /dev/null \
  --scanners vuln,secret,misconfig,license --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL \
  --include-dev-deps --include-non-failures --list-all-pkgs --show-suppressed \
  --skip-db-update --skip-java-db-update --skip-check-update --skip-vex-repo-update \
  --cache-dir /cache --no-progress --exit-code 0 --format json \
  --output /out/trivy-report.json || status=$?
if [ -f "${output}/trivy-report.json" ]; then
  cp "${output}/trivy-report.json" "${RUNNER_TEMP}/trivy-report.txt"
elif [ "$status" -eq 0 ]; then
  echo '::error::Trivy returned success without a report.' >&2
  exit 1
fi
if [ "$status" -ne 0 ]; then
  printf '::error::Trivy execution incomplete (exit %s).\n' "$status" >&2
  exit "$status"
fi
node scripts/ci/scan-policy.mjs assess "$output/trivy-report.json" "$output/source" \
  "$output/source.json" "$cache" "$output/database.json" "$output" "$output/qualification.json"
