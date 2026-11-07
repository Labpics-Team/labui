#!/usr/bin/env bash
set -euo pipefail
exec 2>&1

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$root"
if [ "$#" -ne 0 ] && { [ "$#" -ne 2 ] || [ "$1" != --icons-consumer ]; }; then
  echo '::error::Expected no arguments or --icons-consumer <checkout>.' >&2
  exit 2
fi

# Вывод проверяемого кода не должен исполнять команды GitHub Actions.
resume_token="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
[[ "$resume_token" =~ ^[0-9a-f]{64}$ ]]
trap 'printf "::%s::\n" "$resume_token"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf '::stop-commands::%s\n' "$resume_token"

if [ "$#" -ne 0 ]; then
  icons_root="$(cd -- "$2" && pwd -P)"
  if ! { [ "$icons_root" != "$root" ] && [ -d "$icons_root/.git" ] && [ -d "$root/.git" ] &&
    [[ "${UI_SOURCE_COMMIT:-}" =~ ^[0-9a-f]{40}$ ]]; }; then
    echo '::error::Icons consumer requires distinct checkouts and the exact Lab UI SHA.' >&2
    exit 1
  fi
  node --input-type=module -e 'import { assertActionsRunner } from "./apps/docs/tests/icons-packed.mjs"; assertActionsRunner();'
fi

corepack_dir="$RUNNER_TEMP/labui-corepack"
npm install --global --prefix "$corepack_dir" --ignore-scripts --no-audit --no-fund corepack@0.36.0
export PATH="$corepack_dir/bin:$PATH"
pnpm install --frozen-lockfile
if [ "$#" -ne 0 ]; then
  output="$(mktemp -d "$RUNNER_TEMP/labui-icons.XXXXXX")"
  mkdir -p "$output/icons" "$output/ui-core" "$output/ui-materials" "$output/ui-tokens" "$output/ui-shadow"
  cd "$icons_root"
  pnpm install --frozen-lockfile
  pnpm pack --pack-destination "$output"/icons
  cd "$root"
  pnpm --filter @labpics/ui-core... build
  pnpm --dir packages/core pack --pack-destination "$output"/ui-core
  pnpm --dir packages/materials pack --pack-destination "$output"/ui-materials
  pnpm --dir packages/tokens pack --pack-destination "$output"/ui-tokens
  pnpm --dir packages/shadow pack --pack-destination "$output"/ui-shadow
  LABUI_ICONS_GIT_DIAGNOSTICS="$output" node apps/docs/tests/prepare-icons-inputs.mjs \
    --icons-source "$icons_root" --ui-source "$root" --ui-commit "$UI_SOURCE_COMMIT" \
    --icons-tarball "$output"/icons/*.tgz \
    --ui-core-tarball "$output"/ui-core/*.tgz \
    --ui-materials-tarball "$output"/ui-materials/*.tgz \
    --ui-tokens-tarball "$output"/ui-tokens/*.tgz \
    --ui-shadow-tarball "$output"/ui-shadow/*.tgz --out "$output/inputs"
  status=0
  node apps/docs/tests/icons-packed.mjs \
    --icons-tarball "$output"/icons/*.tgz \
    --ui-core-tarball "$output"/ui-core/*.tgz \
    --ui-materials-tarball "$output"/ui-materials/*.tgz \
    --ui-tokens-tarball "$output"/ui-tokens/*.tgz \
    --ui-shadow-tarball "$output"/ui-shadow/*.tgz \
    --subject "$output/inputs/subject.json" --out "$output/result" || status=$?
  node apps/docs/tests/prepare-icons-inputs.mjs --summarize "$output" --consumer-exit-code "$status" || {
    if [ "$status" -eq 0 ]; then status=1; fi
  }
  exit "$status"
else
  pnpm --filter "@labpics/ui-docs^..." build
  pnpm --filter @labpics/ui-docs exec playwright install chromium webkit
  pnpm --filter @labui/colors fx:render
  pnpm test:e2e
fi
