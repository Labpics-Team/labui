#!/usr/bin/env bash
set -euo pipefail
exec 2>&1

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$root"
if [ "$#" -ne 0 ] && { [ "$#" -ne 2 ] || [ "$1" != --icons-consumer ]; }; then
  echo '::error::Expected no arguments or --icons-consumer <checkout>.' >&2
  exit 2
fi
if [ "$#" -ne 0 ]; then
  node --input-type=module -e 'import { assertActionsRunner } from "./apps/docs/tests/icons-packed.mjs"; assertActionsRunner();'
fi

# Вывод проверяемого кода не должен исполнять команды GitHub Actions.
resume_token="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
[[ "$resume_token" =~ ^[0-9a-f]{64}$ ]]
trap 'printf "::%s::\n" "$resume_token"' EXIT
printf '::stop-commands::%s\n' "$resume_token"

corepack enable
pnpm install --frozen-lockfile
if [ "$#" -eq 0 ]; then
  pnpm build
  pnpm --filter @labpics/ui-docs exec playwright install chromium webkit
  pnpm --filter @labui/colors fx:render
  pnpm test:e2e
else
  icons_root="$(cd -- "$2" && pwd -P)"
  output="$(mktemp -d "$RUNNER_TEMP/labui-icons.XXXXXX")"
  mkdir -p "$output/icons" "$output/ui-core" "$output/ui-shadow"
  cd "$icons_root"
  pnpm install --frozen-lockfile
  pnpm pack --pack-destination "$output/icons"
  cd "$root"
  pnpm --filter @labpics/ui-core... build
  pnpm --dir packages/core pack --pack-destination "$output/ui-core"
  pnpm --dir packages/shadow pack --pack-destination "$output/ui-shadow"
  LABUI_ICONS_GIT_DIAGNOSTICS="$output" node apps/docs/tests/prepare-icons-inputs.mjs \
    --icons-source "$icons_root" --ui-source "$root" --ui-commit "$UI_SOURCE_COMMIT" \
    --icons-tarball "$output"/icons/*.tgz \
    --ui-core-tarball "$output"/ui-core/*.tgz \
    --ui-shadow-tarball "$output"/ui-shadow/*.tgz --out "$output/inputs"
  status=0
  node apps/docs/tests/icons-packed.mjs \
    --icons-tarball "$output"/icons/*.tgz \
    --ui-core-tarball "$output"/ui-core/*.tgz \
    --ui-shadow-tarball "$output"/ui-shadow/*.tgz \
    --subject "$output/inputs/subject.json" --out "$output/result" || status=$?
  node apps/docs/tests/prepare-icons-inputs.mjs --summarize "$output" --consumer-exit-code "$status" || {
    if [ "$status" -eq 0 ]; then status=1; fi
  }
  exit "$status"
fi
