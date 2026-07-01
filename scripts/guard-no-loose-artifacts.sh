#!/usr/bin/env bash
# guard-no-loose-artifacts.sh
#
# CI guard: prevents loose audit/demo artifacts from landing on main.
# Run against the staged index (git diff --cached --name-only).
#
# Exit 0  — no forbidden artifacts found.
# Exit 1  — one or more forbidden artifacts found; names printed to stderr.
#
# Forbidden patterns (must stay in sync with packages/guard/test/clean-landing.test.ts
# PATTERN_SPECIMENS list — adding a pattern here requires a matching specimen entry
# in the test file):
#
#   .audit-*.png          audit PNGs at repo root
#   _typography-*.png     typography audit PNGs at repo root
#   icons-variant-*-screenshot.png
#   .audit-ux/**          audit-ux directory tree
#   .pw-audit/**          playwright audit directory tree
#   .peertmp/**           peer temp directory tree
#   _provenance/**        provenance directory tree
#   apps/docs/src/icons-demo.tsx
#   apps/docs/src/icons.html
#   packages/icons/src/data*
#   packages/icons/src/react.tsx
#   packages/icons/src/registry.ts
#   packages/icons/src/render.ts
#   packages/icons/src/types.ts
#   packages/icons/NOTICE
#   packages/icons/scripts/**

set -euo pipefail

# Collect staged files from the index. --diff-filter=ACMR excludes staged
# deletes (D): removing a forbidden artifact is a legitimate cleanup and must
# not itself be blocked by this guard.
# Fall back to listing all tracked files if there is nothing staged
# (supports running the guard against an already-committed tree in CI).
STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)
if [ -z "$STAGED" ]; then
  STAGED=$(git ls-files 2>/dev/null)
fi

FOUND=0

check_and_report() {
  local path="$1"
  printf "FORBIDDEN artifact found: %s\n" "$path" >&2
  FOUND=1
}

while IFS= read -r file; do
  [ -z "$file" ] && continue

  # .audit-*.png at root
  case "$file" in
    .audit-*.png) check_and_report "$file" ;;
  esac

  # _typography-*.png at root
  case "$file" in
    _typography-*.png) check_and_report "$file" ;;
  esac

  # icons-variant-*-screenshot.png at root
  case "$file" in
    icons-variant-*-screenshot.png) check_and_report "$file" ;;
  esac

  # .audit-ux/ directory tree
  case "$file" in
    .audit-ux/*) check_and_report "$file" ;;
  esac

  # .pw-audit/ directory tree
  case "$file" in
    .pw-audit/*) check_and_report "$file" ;;
  esac

  # .peertmp/ directory tree
  case "$file" in
    .peertmp/*) check_and_report "$file" ;;
  esac

  # _provenance/ directory tree
  case "$file" in
    _provenance/*) check_and_report "$file" ;;
  esac

  # apps/docs/src/icons-demo.tsx
  case "$file" in
    apps/docs/src/icons-demo.tsx) check_and_report "$file" ;;
  esac

  # apps/docs/src/icons.html
  case "$file" in
    apps/docs/src/icons.html) check_and_report "$file" ;;
  esac

  # packages/icons/src/data*
  case "$file" in
    packages/icons/src/data*) check_and_report "$file" ;;
  esac

  # packages/icons/src/react.tsx
  case "$file" in
    packages/icons/src/react.tsx) check_and_report "$file" ;;
  esac

  # packages/icons/src/registry.ts
  case "$file" in
    packages/icons/src/registry.ts) check_and_report "$file" ;;
  esac

  # packages/icons/src/render.ts
  case "$file" in
    packages/icons/src/render.ts) check_and_report "$file" ;;
  esac

  # packages/icons/src/types.ts
  case "$file" in
    packages/icons/src/types.ts) check_and_report "$file" ;;
  esac

  # packages/icons/NOTICE
  case "$file" in
    packages/icons/NOTICE) check_and_report "$file" ;;
  esac

  # packages/icons/scripts/ directory tree
  case "$file" in
    packages/icons/scripts/*) check_and_report "$file" ;;
  esac

done <<< "$STAGED"

if [ "$FOUND" -eq 1 ]; then
  printf "\nguard-no-loose-artifacts: FAILED — remove the forbidden artifacts above before committing.\n" >&2
  exit 1
fi

exit 0
