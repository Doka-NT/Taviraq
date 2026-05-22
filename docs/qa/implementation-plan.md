# QA Catalog Implementation Plan

## Goal

Build and maintain a complete, grouped list of Taviraq product features and test cases. The catalog must cover the current codebase, public docs, merged and closed GitHub PRs, closed issues, and first-parent commit history.

## Sources

- Repository code: `src/shared/types.ts`, `src/preload/index.ts`, `src/main/index.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/components/*`, `src/renderer/src/i18n/translations.ts`.
- Product docs: `README.md`, `docs/security-privacy.md`, `docs/safety-eval.md`, `docs/release-checklist.md`, `docs/signing-notarization.md`, `docs/comparison.md`.
- Existing tests: `tests/unit`, `tests/ui`, `tests/integration`.
- GitHub history:
  - `gh pr list --repo Doka-NT/Taviraq --state merged --limit 100`
  - `gh pr list --repo Doka-NT/Taviraq --state closed --limit 100`
  - `gh issue list --repo Doka-NT/Taviraq --state closed --limit 100`
  - `git log --first-parent --date=short --pretty=format:'%h %ad %s' origin/main`

## Deliverables

- `docs/qa/README.md` for catalog conventions.
- `docs/qa/feature-matrix.md` for grouped feature inventory.
- `docs/qa/manual-qa.md` for real macOS/manual scenarios.
- `docs/qa/test-cases/*.md` for executable-style test cases grouped by product domain.
- Optional screenshots under `docs/qa/assets/` only for visually important P0/P1 cases.

## Process

1. Inventory features from current code and docs.
2. Enrich inventory from merged PRs, closed PRs, closed issues, and commit history.
3. Deduplicate features and group by product domain.
4. Convert bugfixes and UX issues into regression test cases.
5. Mark existing coverage using current tests.
6. Mark missing automation by layer: unit, integration, UI, Electron smoke, or manual.
7. Keep test case IDs stable so future automated tests can reference them in test names.

## Assumptions

- Baseline is `origin/main` unless a release branch or tag is explicitly chosen.
- Open worktree branches are not treated as product truth until merged.
- Test cases document behavior; they do not implement new automated tests.
- Screenshots are reference artifacts, not required for every case.

