# LLM Agent QA Runbook

This runbook defines how an LLM agent should run Taviraq QA test cases and produce a report that another human or agent can continue from.

## Core Rules

1. Treat `docs/qa/test-cases/*.md` as the source of truth for test case IDs, titles, steps, expected results, and automation notes.
2. Before a run, generate a run checklist with `node scripts/qa-cases.mjs report`.
3. Run only the requested scope: all cases, a group, a priority, a type, or explicit IDs.
4. For automated cases, prefer the narrowest relevant command from the case's `Automation` section.
5. For manual or Electron smoke cases, run the closest safe local verification and clearly mark environment blockers.
6. Never mark a case as passed if one of its expected results was not checked.
7. Every `❌` or `⚠️` case must include `Reason`, `Expected`, `Actual`, `Evidence`, and `Next`.
8. Repeat every failed, blocked, or skipped case in the `Not Passed` block.

## Useful Commands

List every case:

```bash
node scripts/qa-cases.mjs list
```

List cases in one group:

```bash
node scripts/qa-cases.mjs list --group terminal-core
```

List P0 cases:

```bash
node scripts/qa-cases.mjs list --priority P0
```

List cases by type:

```bash
node scripts/qa-cases.mjs list --type "Electron smoke"
```

Generate a Markdown report checklist for all cases:

```bash
node scripts/qa-cases.mjs report --output /tmp/taviraq-qa-report.md
```

Generate a report checklist for selected cases:

```bash
node scripts/qa-cases.mjs report --ids TC-TERMINAL-001,TC-SAFETY-001 --output /tmp/taviraq-focused-qa.md
```

Print machine-readable JSON:

```bash
node scripts/qa-cases.mjs json
```

## Recommended Run Scopes

Release readiness:

```bash
node scripts/qa-cases.mjs report --priority P0 --output /tmp/taviraq-p0-qa.md
```

Security and safety:

```bash
node scripts/qa-cases.mjs report --group security-privacy --group command-safety --output /tmp/taviraq-security-qa.md
```

UI smoke:

```bash
node scripts/qa-cases.mjs report --type UI --type "Electron smoke" --output /tmp/taviraq-ui-smoke.md
```

## Result Semantics

- `✅` passed: all expected results were checked and matched.
- `❌` failed: the case ran, but at least one expected result did not match.
- `⚠️` blocked: the case could not be fully run because of missing environment, credentials, OS support, provider access, SSH host, or packaging requirement.

Do not use `✅` for partial verification. Use `⚠️` and describe what was not checked.

