#!/usr/bin/env bash
set -euo pipefail
exec 2>&1

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$root"
if [ "$#" -ne 0 ] && { [ "$#" -ne 2 ] || { [ "$1" != --icons-consumer ] && [ "$1" != --colors-consumer ]; }; }; then
  echo '::error::Expected no arguments, --icons-consumer <checkout>, or --colors-consumer <verified input>.' >&2
  exit 2
fi
if [ "$#" -ne 0 ]; then
  if [ "$1" = --colors-consumer ]; then
    node scripts/ci/colors-consumer-input.mjs same-job-identity
    test "$(GIT_MASTER=1 git rev-parse HEAD)" = "$UI_SOURCE_COMMIT"
    test "$(id -u)" != 0
    colors_root="$(cd -- "$2" && pwd -P)"
    runner_root="$(cd -- "$RUNNER_TEMP" && pwd -P)"
    [[ "$colors_root" = "$runner_root"/labui-colors-inputs.*/verified ]]
    export E2E_SMOKE=0
  else
    node --input-type=module -e 'import { assertActionsRunner } from "./apps/docs/tests/icons-packed.mjs"; assertActionsRunner();'
  fi
fi

# Вывод проверяемого кода не должен исполнять команды GitHub Actions.
resume_token="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
[[ "$resume_token" =~ ^[0-9a-f]{64}$ ]]
trap 'printf "::%s::\n" "$resume_token"' EXIT
printf '::stop-commands::%s\n' "$resume_token"

corepack enable
if [ "$#" -ne 0 ] && [ "$1" = --colors-consumer ]; then
  manifest_backup="$(mktemp "$RUNNER_TEMP/labui-colors-package.XXXXXX")"
  lock_backup="$(mktemp "$RUNNER_TEMP/labui-colors-lock.XXXXXX")"
  cp packages/colors/package.json "$manifest_backup"
  cp pnpm-lock.yaml "$lock_backup"
  trap 'status=$?; cp "$manifest_backup" packages/colors/package.json; cp "$lock_backup" pnpm-lock.yaml; rm -f -- "$manifest_backup" "$lock_backup"; printf "::%s::\n" "$resume_token"; exit "$status"' EXIT
  tarball="$(node scripts/ci/colors-consumer-input.mjs path "$colors_root")"
  pnpm --filter @labui/colors add "@labpics/colors@${tarball}" --lockfile-only --ignore-scripts
fi
pnpm install --frozen-lockfile
if [ "$#" -ne 0 ] && [ "$1" = --colors-consumer ]; then
  node scripts/ci/colors-consumer-input.mjs installed "$colors_root" "$root/packages/colors/node_modules/@labpics/colors"
fi
if [ "$#" -eq 0 ] || [ "$1" = --colors-consumer ]; then
  pnpm build
  if [ "$#" -ne 0 ] && [ "$1" = --colors-consumer ]; then
    pnpm typecheck
    pnpm test
    pnpm --filter @labpics/ui-docs exec playwright install --with-deps chromium webkit
  else
    pnpm --filter @labpics/ui-docs exec playwright install chromium webkit
  fi
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
