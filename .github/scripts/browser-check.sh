#!/usr/bin/env bash
set -euo pipefail
# Один поток сохраняет порядок отключения команд относительно stdout и stderr workload.
exec 2>&1

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
image='mcr.microsoft.com/playwright:v1.55.1-noble@sha256:2f29369043d81d6d69a815ceb80760f55e85f5020371ad06a4d996f18503ad1c'
job="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/labui-browser.XXXXXX")"
commands_paused=false
ci_resume_token=''

resume_commands() {
  if [ "$commands_paused" = true ]; then printf '::%s::\n' "$ci_resume_token"; fi
}

directory_path() {
  local current="$1" component
  local -a components
  IFS=/ read -r -a components <<< "$2"
  for component in "${components[@]}"; do
    current="${current}/${component}"
    if [ -L "$current" ] || { [ -e "$current" ] && [ ! -d "$current" ]; }; then
      echo '::error::Artifact path contains a link or a non-directory.' >&2
      return 1
    fi
  done
}

copy_artifact() {
  local source="${job}/work/source/$1" destination="${root}/$1" tree invalid
  directory_path "${job}/work" "source/$1" || return 1
  directory_path "$root" "$1" || return 1
  [ -d "$source" ] || return 0
  for tree in "$source" "$destination"; do
    [ -d "$tree" ] || continue
    if ! invalid="$(find "$tree" ! -type d \( ! -type f -o -links +1 \) -print -quit)"; then return 1; fi
    if [ -n "$invalid" ]; then
      echo '::error::Artifacts must contain only directories and regular files without links.' >&2
      return 1
    fi
  done
  if ! mkdir -p -- "$destination" || ! cp -a -- "${source}/." "${destination}/"; then return 1; fi
  artifact_outputs+=("$2=true")
}

cleanup() {
  status=$?
  artifact_outputs=()
  artifacts_safe=true
  trap - EXIT
  if [ -s "${job}/container.id" ]; then
    container="$(cat "${job}/container.id")"
    if ! docker rm --force "$container" >/dev/null; then
      echo '::error::Container removal failed; artifact export and directory cleanup are unsafe.' >&2
      resume_commands
      exit 1
    fi
  fi
  # После удаления контейнера содержимое стабильно; ссылки не переносятся на хост.
  if ! copy_artifact packages/colors/artifacts/fx-render fx_ready; then status=1; artifacts_safe=false; fi
  if ! copy_artifact apps/docs/playwright-report report_ready; then status=1; artifacts_safe=false; fi
  if ! rm -rf -- "$job"; then status=1; artifacts_safe=false; fi
  if [ "$artifacts_safe" = true ] && [ "${#artifact_outputs[@]}" -gt 0 ] && [ -n "${GITHUB_OUTPUT:-}" ]; then
    if ! printf '%s\n' "${artifact_outputs[@]}" >> "$GITHUB_OUTPUT"; then status=1; fi
  fi
  if ! resume_commands; then status=1; fi
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
    pnpm install --frozen-lockfile --store-dir /job/pnpm-store
    pnpm build
    pnpm --filter @labpics/ui-docs exec playwright install chromium webkit
    pnpm --filter @labui/colors fx:render
    pnpm test:e2e
  '
# Вывод workload и ошибки чтения его файлов не могут задавать Actions outputs.
ci_resume_token="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
[[ "$ci_resume_token" =~ ^[0-9a-f]{64}$ ]]
commands_paused=true
printf '::stop-commands::%s\n' "$ci_resume_token"
docker start --attach "$(cat "${job}/container.id")"
