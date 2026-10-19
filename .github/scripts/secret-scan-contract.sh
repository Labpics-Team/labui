#!/usr/bin/env bash
# Sourced by security: exercise its exact secret_scan function and already verified Trivy binary.
# Nothing is written to checkout; no credential is read or used for authentication.
(
  set -euo pipefail
  fixture=$(mktemp -d "$RUNNER_TEMP/labui-secret-contract.XXXXXX")
  trap 'rm -rf -- "$fixture"' EXIT
  mkdir -p "$fixture/tree"
  printf 'ordinary documentation\n' > "$fixture/tree/README.md"
  printf '{}\n' > "$fixture/defaults.yaml"
  check_scan() {
    local label=$1 expected=$2
    shift 2
    local status=0
    rm -f "$fixture/report.json" "$fixture/stderr"
    (cd "$fixture/tree" && secret_scan --offline-scan --skip-db-update --skip-java-db-update \
      --format json --output "$fixture/report.json" "$@") 2>"$fixture/stderr" || status=$?
    if [[ "$status" != "$expected" ]]; then
      printf 'Secret scan contract [%s]: expected exit %s, got %s\n' "$label" "$expected" "$status" >&2
      # stderr contains scanner diagnostics; fixture content lives only in the JSON report.
      cat "$fixture/stderr" >&2
      return 1
    fi
  }
  # Clean control distinguishes finding detection from a scanner/configuration failure.
  check_scan clean 0
  for path in tests/fixture.txt examples/fixture.txt guide.md; do
    mkdir -p "$fixture/tree/$(dirname "$path")"
    # Deliberately synthetic AWS-shaped identifier, assembled only in the temporary tree.
    printf 'AKIA%s\n' '0123456789ABCDEF' > "$fixture/tree/$path"
    check_scan "detect:$path" 1
    grep -q '"RuleID": "aws-access-key-id"' "$fixture/report.json"
    # Disabling our configuration restores the built-in allow rule: same input must be missed.
    # Trivy decodes this YAML: /dev/null returns EOF, not the default configuration.
    check_scan "allow:$path" 0 --secret-config "$fixture/defaults.yaml"
    rm "$fixture/tree/$path"
  done
  # A genuine scanner configuration error must fail; it is not a secret finding.
  printf 'rules: [\n' > "$fixture/invalid.yaml"
  check_scan scanner-error 1 --secret-config "$fixture/invalid.yaml"
  test -s "$fixture/stderr"
  test ! -s "$fixture/report.json"
  printf 'secret scan contract: PASS (clean, tests/examples/markdown, allow-rule controls, scanner error)\n'
)
