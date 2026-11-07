#!/usr/bin/env bash
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
export CORE_INPUT_MODE=same-job CORE_RUN_ID="$GITHUB_RUN_ID" CORE_RUN_ATTEMPT="$GITHUB_RUN_ATTEMPT" CORE_JOB="$GITHUB_JOB"
: "${VERIFIED_MANIFEST:?}" "${VERIFIED_TARBALL:?}" "${CORE_SOURCE_SHA:?}" "${CORE_TARBALL_SHA256:?}" "${CORE_MANIFEST_SHA256:?}" "${UI_SOURCE_COMMIT:?}" "${RUNNER_TEMP:?}"
node "$root/scripts/ci/colors-consumer-input.mjs" same-job-identity
[[ "$VERIFIED_MANIFEST" = "$GITHUB_WORKSPACE/packages/colors/.release/release-manifest.json" ]]
producer_tmp="$(node --input-type=module -e 'import { tmpdir } from "node:os"; process.stdout.write(tmpdir());')"
[[ "$VERIFIED_TARBALL" = "$producer_tmp"/labcolors-release-verified-*/"$CORE_TARBALL_SHA256".tgz ]]
test "$(GIT_MASTER=1 git -C "$root" rev-parse HEAD)" = "$UI_SOURCE_COMMIT"
test "$(id -u)" != 0
input="$(mktemp -d "$RUNNER_TEMP/labui-colors-inputs.XXXXXX")"
trap 'rm -rf -- "$input"' EXIT
node "$root/scripts/ci/colors-consumer-input.mjs" prepare-same-job "$VERIFIED_MANIFEST" "$VERIFIED_TARBALL" "$input/verified"
export CORE_INPUT_DIR="$input/verified" E2E_SMOKE=0
bash "$root/.github/scripts/browser-check.sh" --colors-consumer "$CORE_INPUT_DIR"
