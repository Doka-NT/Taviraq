# Packaging And Release Test Cases

## TC-RELEASE-001: CI verify runs lint, typecheck, tests, and build

- Priority: P0
- Type: CI
- Sources: `.github/workflows/ci.yml`
- Coverage: existing
- Screenshot: none

Steps:
1. Open a pull request.
2. Wait for CI Verify.

Expected:
- `npm ci` completes.
- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- Failure logs identify the failing step.

Automation:
- Existing: GitHub Actions CI.
- Missing: none.

## TC-RELEASE-002: macOS directory package launches

- Priority: P0
- Type: manual, Electron smoke
- Sources: `package:mac:dir`, README
- Coverage: manual
- Screenshot: none

Steps:
1. Run `npm run package:mac:dir` on macOS.
2. Launch generated `.app`.
3. Run `echo package-smoke`.

Expected:
- Native modules load.
- App opens with current built renderer assets.
- Terminal output works.

Automation:
- Existing: build script.
- Missing: packaged-app smoke automation.

## TC-RELEASE-003: Unsigned ZIP follows first-launch instructions

- Priority: P1
- Type: manual
- Sources: README, release workflow
- Coverage: manual
- Screenshot: none

Steps:
1. Download or build unsigned ZIP.
2. Unzip and move app to Applications.
3. Launch using README first-launch instructions.

Expected:
- macOS unsigned warning is expected and recoverable.
- App name is `Taviraq.app`.
- README instructions match actual behavior.

Automation:
- Existing: none.
- Missing: manual only unless notarized release pipeline changes.

## TC-RELEASE-004: Daily release tag creates next patch tag only when main changed

- Priority: P1
- Type: CI
- Sources: PR #4, PR #13, `.github/workflows/daily-release-tag.yml`
- Coverage: existing in workflow
- Screenshot: none

Steps:
1. Trigger daily release tag workflow with no changes since latest tag.
2. Trigger after new main commit.

Expected:
- No-change run exits without tag.
- Changed run creates next patch tag.
- Release workflow is triggered for the tag.

Automation:
- Existing: workflow logic.
- Missing: no local automated test for workflow script.

## TC-RELEASE-005: Release workflow publishes ZIP and checksums

- Priority: P0
- Type: CI, manual
- Sources: `.github/workflows/release.yml`, docs/release-checklist.md
- Coverage: existing/manual
- Screenshot: none

Steps:
1. Trigger release workflow for tag `vX.Y.Z`.
2. Inspect release assets.
3. Verify checksum locally.

Expected:
- ZIP and `checksums.txt` are uploaded.
- Release notes include verification and unsigned-build instructions.
- `shasum -a 256 -c checksums.txt` passes.

Automation:
- Existing: release workflow.
- Missing: manual asset verification after publish.

## TC-RELEASE-006: Demo recording script produces usable media

- Priority: P2
- Type: manual
- Sources: commit `f19c1cb`, README media
- Coverage: missing/manual
- Screenshot: none

Steps:
1. Run demo recording script.
2. Run GIF variant if needed.
3. Inspect generated media.

Expected:
- Script completes without modifying source unexpectedly.
- Media shows intended local/assistant flow.
- README media path remains valid.

Automation:
- Existing: none.
- Missing: manual media QA.

