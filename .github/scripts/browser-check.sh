#!/usr/bin/env bash
set -euo pipefail
# Один поток сохраняет порядок отключения команд относительно stdout и stderr workload.
exec 2>&1

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
image='mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f'
workload=e2e
source_options=()
if [ "$#" -ne 0 ]; then
  if [ "$#" -ne 2 ] || [ "$1" != --icons-consumer ]; then
    echo '::error::Expected no arguments or --icons-consumer <checkout>.' >&2
    exit 2
  fi
  icons_root="$(cd -- "$2" && pwd -P)"
  if ! { [ "$icons_root" != "$root" ] && [ -d "$icons_root/.git" ] && [ -d "$root/.git" ] &&
    [ "${GITHUB_ACTIONS:-}" = true ] && [ "${RUNNER_ENVIRONMENT:-}" = self-hosted ] &&
    [[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ ]] && [[ "${UI_SOURCE_COMMIT:-}" =~ ^[0-9a-f]{40}$ ]]; }; then
    echo '::error::Icons consumer requires distinct checkouts and a self-hosted Actions identity.' >&2
    exit 1
  fi
  icons_uid="$(id -u)"
  if ! [[ "$icons_uid" =~ ^[1-9][0-9]*$ ]]; then
    echo '::error::Icons consumer requires a non-root host UID.' >&2
    exit 1
  fi
  workload=icons-consumer
  source_options+=(--mount "type=bind,source=${icons_root},target=/icons-source,readonly")
  for variable in GITHUB_ACTIONS GITHUB_RUN_ID GITHUB_RUN_ATTEMPT RUNNER_ENVIRONMENT RUNNER_NAME RUNNER_OS UI_SOURCE_COMMIT; do
    source_options+=(--env "$variable")
  done
fi
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
  local source_path="${3:-source/$1}" destination="${root}/$1" tree invalid source
  source="${job}/work/${source_path}"
  directory_path "${job}/work" "$source_path" || return 1
  directory_path "$root" "$1" || return 1
  [ -d "$source" ] || return 0
  if [ "$workload" = icons-consumer ] && [ -e "$destination" ]; then
    echo '::error::Icons evidence requires a fresh destination.' >&2
    return 1
  fi
  if [ "$workload" = icons-consumer ] && ! node "$root/apps/docs/tests/prepare-icons-inputs.mjs" --verify-public "$source"; then
    return 1
  fi
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

cleanup_failure() {
  if [ "$status" -eq 0 ]; then status=1; fi
  artifacts_safe=false
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
      cleanup_failure
      resume_commands
      exit "$status"
    fi
  fi
  # После удаления контейнера содержимое стабильно; ссылки не переносятся на хост.
  if [ "$workload" = icons-consumer ]; then
    # Наружу выходит только проверенная публичная проекция. Raw inputs и архивы
    # производителей остаются во временном каталоге до его удаления.
    if ! rm -f -- "${job}/work/output/.git-trace2.raw"; then
      cleanup_failure
    elif [ ! -f "${job}/work/output/public/manifest.json" ] || [ -L "${job}/work/output/public/manifest.json" ]; then
      echo '::error::Complete public Icons evidence is missing.' >&2
      cleanup_failure
    elif ! copy_artifact apps/docs/test-results/icons-consumer icons_ready output/public; then
      cleanup_failure
    fi
  else
    if ! copy_artifact packages/colors/artifacts/fx-render fx_ready; then cleanup_failure; fi
    if ! copy_artifact apps/docs/playwright-report report_ready; then cleanup_failure; fi
  fi
  if ! rm -rf -- "$job"; then cleanup_failure; fi
  if [ "$artifacts_safe" = true ] && [ "${#artifact_outputs[@]}" -gt 0 ] && [ -n "${GITHUB_OUTPUT:-}" ]; then
    if ! printf '%s\n' "${artifact_outputs[@]}" >> "$GITHUB_OUTPUT"; then cleanup_failure; fi
  fi
  if ! resume_commands; then cleanup_failure; fi
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
  --env "LABUI_BROWSER_WORKLOAD=$workload" "${source_options[@]}" \
  --env "E2E_SMOKE=${E2E_SMOKE:-}" "$image" bash -euo pipefail -c '
    mkdir -p /job/source /job/bin /job/home
    if [ "$LABUI_BROWSER_WORKLOAD" = icons-consumer ]; then
      tar -C /source --exclude=node_modules -cf - . | tar -C /job/source -xf -
      mkdir /job/icons /job/output /job/output/icons /job/output/ui-core /job/output/ui-materials /job/output/ui-tokens /job/output/ui-shadow
      tar -C /icons-source --exclude=node_modules -cf - . | tar -C /job/icons -xf -
    else
      tar -C /source --exclude=.git --exclude=node_modules -cf - . | tar -C /job/source -xf -
    fi
    cd /job/source
    export COREPACK_HOME=/job/corepack PATH="/job/bin:$PATH"
    # Node.js 25+ не содержит Corepack; bootstrap остаётся в каталоге задания.
    npm install --global --prefix /job --cache /job/npm-cache --ignore-scripts --no-audit --no-fund corepack@0.36.0
    corepack enable --install-directory /job/bin
    pnpm install --frozen-lockfile --store-dir /job/pnpm-store
    if [ "$LABUI_BROWSER_WORKLOAD" = icons-consumer ]; then
      # Corepack выбирает packageManager каждого checkout; stores не пересекаются.
      cd /job/icons
      pnpm install --frozen-lockfile --store-dir /job/icons-pnpm-store
      pnpm pack --pack-destination /job/output/icons
      cd /job/source
      pnpm --filter @labpics/ui-core... build
      pnpm --dir packages/core pack --pack-destination /job/output/ui-core
      pnpm --dir packages/materials pack --pack-destination /job/output/ui-materials
      pnpm --dir packages/tokens pack --pack-destination /job/output/ui-tokens
      pnpm --dir packages/shadow pack --pack-destination /job/output/ui-shadow
      LABUI_ICONS_GIT_DIAGNOSTICS=/job/output node apps/docs/tests/prepare-icons-inputs.mjs \
        --icons-source /job/icons --ui-source /job/source --ui-commit "$UI_SOURCE_COMMIT" \
        --icons-tarball /job/output/icons/*.tgz \
        --ui-core-tarball /job/output/ui-core/*.tgz \
        --ui-materials-tarball /job/output/ui-materials/*.tgz \
        --ui-tokens-tarball /job/output/ui-tokens/*.tgz \
        --ui-shadow-tarball /job/output/ui-shadow/*.tgz --out /job/output/inputs
      status=0
      node apps/docs/tests/icons-packed.mjs \
        --icons-tarball /job/output/icons/*.tgz \
        --ui-core-tarball /job/output/ui-core/*.tgz \
        --ui-materials-tarball /job/output/ui-materials/*.tgz \
        --ui-tokens-tarball /job/output/ui-tokens/*.tgz \
        --ui-shadow-tarball /job/output/ui-shadow/*.tgz \
        --subject /job/output/inputs/subject.json --out /job/output/result || status=$?
      node apps/docs/tests/prepare-icons-inputs.mjs --summarize /job/output || { if [ "$status" -eq 0 ]; then status=1; fi; }
      exit "$status"
    else
      pnpm --filter "@labpics/ui-docs^..." build
      pnpm --filter @labpics/ui-docs exec playwright install chromium webkit
      pnpm --filter @labui/colors fx:render
      pnpm test:e2e
    fi
  '
# Вывод workload и ошибки чтения его файлов не могут задавать Actions outputs.
ci_resume_token="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
[[ "$ci_resume_token" =~ ^[0-9a-f]{64}$ ]]
commands_paused=true
printf '::stop-commands::%s\n' "$ci_resume_token"
docker start --attach "$(cat "${job}/container.id")"
