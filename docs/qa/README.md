# Taviraq QA Catalog

This folder stores the product feature inventory and test-case catalog for Taviraq.

## Files

- `implementation-plan.md` - the saved plan for building and maintaining this QA catalog.
- `agent-runbook.md` - instructions for LLM agents that run scoped QA passes.
- `feature-matrix.md` - grouped product feature inventory with sources and coverage notes.
- `manual-qa.md` - manual verification scenarios for macOS, SSH, keychain, providers, packaging, and release.
- `test-cases/` - domain-specific test cases.
- `assets/` - optional reference screenshots for visually important cases.

## Agent Runner

Use `scripts/qa-cases.mjs` to list cases, export machine-readable JSON, or generate a report checklist:

```bash
node scripts/qa-cases.mjs list --priority P0
node scripts/qa-cases.mjs json --group command-safety
node scripts/qa-cases.mjs report --ids TC-TERMINAL-001,TC-SAFETY-001 --output /tmp/taviraq-qa-report.md
```

LLM agents should follow `agent-runbook.md` before starting a run.

## Test Case Format

Each test case should use this structure:

```md
## TC-DOMAIN-001: Short behavior title

- Priority: P0 | P1 | P2
- Type: unit | integration | UI | Electron smoke | manual
- Sources: README, docs, PR #N, issue #N, commit title, source file
- Coverage: existing | partial | missing
- Screenshot: none | TODO | `../assets/domain/example.png`

Steps:
1. ...

Expected:
- ...

Automation:
- Existing: ...
- Missing: ...
```

## Priorities

- P0: must pass before release; covers data loss, command safety, secret leakage, core terminal usability, and app launch.
- P1: important daily-driver behavior; should be automated when practical.
- P2: polish, low-risk UX, docs, and release support scenarios.

## Screenshot Policy

Screenshots are required only when visual state is part of the acceptance criteria:

- confirmation modals and command safety trust states;
- security/privacy trust center and masking notices;
- settings, onboarding, and empty states from design-review issues;
- regressions where visibility, layout, or discoverability was the original bug.

Functional cases should not require screenshots unless the UI presentation itself is the product behavior.

## Test Run Report Format

After finishing a test-case run, provide a report grouped by test-case group. The report must be understandable both for humans and for LLM agents that may continue the work later.

Use status icons for every case:

- `✅` passed
- `❌` failed
- `⚠️` blocked or skipped with a reason

For every failed, blocked, or skipped case, include a structured detail block directly under the case line. Keep the field names stable:

- `Reason:` what did not pass or why it could not be run.
- `Expected:` the expected behavior from the test case.
- `Actual:` observed behavior, error, log summary, or environment blocker.
- `Evidence:` command output, screenshot path, log path, PR/commit, or `not captured`.
- `Next:` recommended follow-up action.

Example:

```md
## Terminal Core

- ✅ TC-TERMINAL-001: Create and use a local terminal session
- ❌ TC-TERMINAL-008: Search terminal output
  - Reason: Search panel opened, but no-result state did not render for a missing query.
  - Expected: Missing query shows a clear no-result state and terminal focus is restored after close.
  - Actual: Search input stayed focused and no visible no-result feedback appeared.
  - Evidence: `screenshots/qa/terminal-search-no-result.png`
  - Next: Inspect `TerminalPane` search state handling and add a UI regression test.
- ⚠️ TC-TERMINAL-009: Terminal URLs are clickable
  - Reason: Blocked by environment; external URL opening could not be verified.
  - Expected: Clicking `https://taviraq.dev` calls Electron external URL opening without changing terminal content.
  - Actual: Test environment did not expose external URL opening.
  - Evidence: not captured
  - Next: Re-run in Electron smoke environment with `shell.openExternal` mocked or observable.

## Security And Privacy

- ✅ TC-PRIVACY-001: Provider payload masking removes raw secrets
- ❌ TC-PRIVACY-010: Trust center never shows protected state with no active scopes
  - Reason: UI displayed protected wording while all masking scopes were disabled.
  - Expected: Trust center shows no active protection and avoids green/protected wording.
  - Actual: Header badge said `Protected`.
  - Evidence: `screenshots/qa/privacy-no-scopes.png`
  - Next: Update trust-center state derivation and cover with screenshot smoke test.

## Not Passed

- ❌ Terminal Core TC-TERMINAL-008: Search terminal output
  - Reason: Search panel opened, but no-result state did not render for a missing query.
  - Expected: Missing query shows a clear no-result state and terminal focus is restored after close.
  - Actual: Search input stayed focused and no visible no-result feedback appeared.
  - Evidence: `screenshots/qa/terminal-search-no-result.png`
  - Next: Inspect `TerminalPane` search state handling and add a UI regression test.
- ⚠️ Terminal Core TC-TERMINAL-009: Terminal URLs are clickable
  - Reason: Blocked by environment; external URL opening could not be verified.
  - Expected: Clicking `https://taviraq.dev` calls Electron external URL opening without changing terminal content.
  - Actual: Test environment did not expose external URL opening.
  - Evidence: not captured
  - Next: Re-run in Electron smoke environment with `shell.openExternal` mocked or observable.
- ❌ Security And Privacy TC-PRIVACY-010: Trust center never shows protected state with no active scopes
  - Reason: UI displayed protected wording while all masking scopes were disabled.
  - Expected: Trust center shows no active protection and avoids green/protected wording.
  - Actual: Header badge said `Protected`.
  - Evidence: `screenshots/qa/privacy-no-scopes.png`
  - Next: Update trust-center state derivation and cover with screenshot smoke test.
```

The `Not Passed` block must include every failed, blocked, or skipped case from the grouped sections and repeat the same structured detail block. This duplication is intentional: humans can scan by group, while LLM agents can parse `Not Passed` as a compact remediation backlog.
