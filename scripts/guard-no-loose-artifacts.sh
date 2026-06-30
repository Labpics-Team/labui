#!/usr/bin/env bash
# guard-no-loose-artifacts.sh
#
# Scans git-tracked files for forbidden artifact classes.
# Exits non-zero and names the offending file(s) if any are found.
# Exits 0 on a clean tree.
#
# Forbidden classes:
#   - Audit PNGs at root (.audit-*.png, _typography-*.png, icons-variant-*-screenshot.png)
#   - Audit/scratch dirs (.audit-ux, .pw-audit, .peertmp, _provenance)
#   - Orphan icons demo files (apps/docs/src/icons-demo.tsx, apps/docs/src/icons.html)
#   - Orphan icons package files (packages/icons/src/{data,react.tsx,registry.ts,render.ts,types.ts})
#   - packages/icons/NOTICE, packages/icons/scripts/
#
# Runs against git ls-files (tracked files only) so untracked artifacts in
# .gitignore are never flagged as false positives.
#
# Usage (CI — quality job):
#   bash scripts/guard-no-loose-artifacts.sh

set -euo pipefail

FORBIDDEN_PATTERNS=(
  # Audit PNGs
  '^\.audit-.*\.png$'
  '^_typography-.*\.png$'
  '^icons-variant-.*-screenshot\.png$'
  # Audit / scratch dirs (any file under them)
  '^\.audit-ux/'
  '^\.pw-audit/'
  '^\.peertmp/'
  '^_provenance/'
  # Orphan icons demos in apps/docs
  '^apps/docs/src/icons-demo\.tsx$'
  '^apps/docs/src/icons\.html$'
  # Orphan icons package source files
  '^packages/icons/src/data'
  '^packages/icons/src/react\.tsx$'
  '^packages/icons/src/registry\.ts$'
  '^packages/icons/src/render\.ts$'
  '^packages/icons/src/types\.ts$'
  # Orphan icons package top-level files
  '^packages/icons/NOTICE$'
  '^packages/icons/scripts/'
)

# Collect all tracked files
tracked_files=$(git ls-files)

found=0

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  matches=$(echo "$tracked_files" | grep -E "$pattern" || true)
  if [[ -n "$matches" ]]; then
    echo "GUARD FAIL: forbidden artifact class matched (pattern: ${pattern})" >&2
    echo "$matches" | while read -r f; do
      echo "  tracked: $f" >&2
    done
    found=1
  fi
done

if [[ "$found" -eq 1 ]]; then
  echo "" >&2
  echo "Remove the listed files from git tracking before merging to main." >&2
  exit 1
fi

echo "guard-no-loose-artifacts: clean (no forbidden artifacts tracked)"
exit 0
