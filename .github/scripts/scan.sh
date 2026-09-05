#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${TRIVY_IMAGE:?TRIVY_IMAGE is required}"
cache="${RUNNER_TEMP}/trivycache"
output="$(mktemp -d "${RUNNER_TEMP}/trivy-output.XXXXXX")"
trap 'rm -rf -- "$output"' EXIT
mkdir -p "$cache"
rm -f -- "${RUNNER_TEMP}/trivy-report.txt"

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

status=0
docker run --rm --user "$(id -u):$(id -g)" \
  -v "${PWD}:/src:ro" -v "${cache}:/cache" -v "${output}:/out" \
  "$TRIVY_IMAGE" fs /src \
  --scanners vuln,secret,misconfig --severity HIGH,CRITICAL \
  --skip-db-update --skip-java-db-update --cache-dir /cache --no-progress \
  --exit-code 1 --format table --output /out/trivy-report.txt || status=$?
if [ -f "${output}/trivy-report.txt" ]; then
  cp "${output}/trivy-report.txt" "${RUNNER_TEMP}/trivy-report.txt"
  cat "${output}/trivy-report.txt"
elif [ "$status" -eq 0 ]; then
  echo '::error::Trivy returned success without a report.' >&2
  exit 1
fi
if [ "$status" -ne 0 ]; then
  printf '::error::Trivy verification failed (exit %s).\n' "$status" >&2
fi
exit "$status"
