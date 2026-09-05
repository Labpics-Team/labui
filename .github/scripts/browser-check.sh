#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
image='mcr.microsoft.com/playwright:v1.55.1-noble@sha256:2f29369043d81d6d69a815ceb80760f55e85f5020371ad06a4d996f18503ad1c'
job="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/labui-browser.XXXXXX")"
cleanup() {
  status=$?
  trap - EXIT
  if [ -s "${job}/container.id" ]; then
    container="$(cat "${job}/container.id")"
    if ! docker rm --force "$container" >/dev/null; then status=1; fi
  fi
  for path in packages/colors/artifacts/fx-render apps/docs/playwright-report; do
    if [ -d "${job}/work/source/${path}" ]; then
      if ! mkdir -p "${root}/${path}" || ! cp -a "${job}/work/source/${path}/." "${root}/${path}/"; then status=1; fi
    fi
  done
  if ! rm -rf -- "$job"; then status=1; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Каждый запуск получает свои процессы, сеть и writable-файлы; порты хоста не нужны.
# CID хранится вне writable-mount: очистка знает созданный контейнер даже при прерывании create.
mkdir "${job}/work"
docker create --cidfile "${job}/container.id" --init --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=${root},target=/source,readonly" \
  --mount "type=bind,source=${job}/work,target=/job" \
  --workdir /job --env CI=true --env HOME=/job/home \
  --env "E2E_SMOKE=${E2E_SMOKE:-}" "$image" bash -euo pipefail -c '
    mkdir -p /job/source /job/bin /job/home
    tar -C /source --exclude=.git --exclude=node_modules -cf - . | tar -C /job/source -xf -
    cd /job/source
    export COREPACK_HOME=/job/corepack PATH="/job/bin:$PATH"
    corepack enable --install-directory /job/bin
    pnpm install --frozen-lockfile
    pnpm build
    pnpm --filter @labpics/ui-docs exec playwright install chromium webkit
    pnpm --filter @labui/colors fx:render
    pnpm test:e2e
  '
docker start --attach "$(cat "${job}/container.id")"
