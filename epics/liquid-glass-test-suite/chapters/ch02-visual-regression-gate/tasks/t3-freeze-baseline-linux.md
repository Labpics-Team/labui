---
id: t3-freeze-baseline-linux
chapter: ch02-visual-regression-gate
epic: liquid-glass-test-suite
title: "Freeze the baseline PNGs in a Linux-Chromium (CI-equivalent) environment and commit them"
status: placeholder
priority: 1
depends_on:
  - t2-bind-to-repo-harness
blocks:
  - t4-determinism-and-sanity-xcheck
agent_profile:
  category: visual-engineering
  skills: [craft-qa, craft-devops]
started: null
completed: null
refine_after:
  - t2-bind-to-repo-harness
---

# Freeze the baseline on Linux Chromium

Will be refined after ch02-t2. Core requirement is already fixed: the committed baseline MUST be frozen in a Linux Chromium environment matching CI (ubuntu-latest, Playwright 1.49.1) — NOT the Windows dev box — or the gate false-fails on first CI run (cross-platform AA/font/raster drift). Exact mechanism (container / `act` / a one-shot CI freeze job / WSL Linux Chromium) and the committed baseline dir path get refined once t2 locks the harness shape.
