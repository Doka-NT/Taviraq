# PR QA Runbook (AI-Driven)

This runbook defines how a Claude Code agent runs QA for a specific pull request by actually launching the Electron app, driving interactions, and analyzing screenshots.

## When to use

Use this runbook when asked to "QA PR #N", "test PR #N", or "verify PR #N".

Do not use this runbook to run the full QA catalog — use `agent-runbook.md` for that.

## Prerequisites

1. The PR branch must be checked out locally.
2. The build must be current for the checked-out branch: run `npm run build` if in doubt.
3. `out/main/index.js` must exist — the script refuses to run without it.

## Workflow

### Step 1 — Fetch PR metadata

```bash
gh pr view <N> --repo Doka-NT/Taviraq --json title,body,headRefName,files
```

Extract from the response:
- `title`: PR title
- `body`: full PR description — find the `## Manual QA` section
- `files[].path`: list of changed source files

### Step 2 — Read changed source files

For each changed `.tsx`, `.ts`, or `.css` file under `src/renderer/src/`, read it.

Look for:
- CSS class names used on interactive elements (`.command-palette`, `.palette-search`, etc.)
- `data-testid` attributes (most stable — prefer these as selectors)
- ARIA roles and accessible names (`role="button"`, `aria-label="..."`)
- React component state that maps to visible UI

This gives you reliable selectors for the steps JSON you will write next.

### Step 3 — Generate steps JSON

Write a JSON file at `/tmp/qa-pr-<N>-steps.json` that maps each `## Manual QA` step from the PR to Playwright actions.

**Rules when generating steps:**

1. Always add a `screenshot` step after each significant interaction (click, keyboard, state change).
2. Add `wait_ms` (200–500 ms) after actions that trigger animations or async updates.
3. Prefer `data-testid` selectors first, then stable CSS classes, then `click_role` with accessible name, then `click` with `text`.
4. Convert Mac shortcuts from the PR description: `⌘⇧K` → `Meta+Shift+K`, `⌘⇧J` → `Meta+Shift+J`, `Escape` → `Escape`.
5. Include `assert_visible` or `assert_text` steps to verify each expected result from the PR.
6. Use `set_viewport` before steps that test a specific width (e.g., "narrow width around 320px" → `{ "action": "set_viewport", "width": 320, "height": 900 }`).

**Example — for PR #100 "Unify command palette" Manual QA step 1:**

> Open the command palette and switch between All, Commands, Snippets, and Prompts.

```json
[
  {
    "action": "press",
    "key": "Meta+Shift+K",
    "name": "open palette via shortcut"
  },
  {
    "action": "wait_ms",
    "ms": 300
  },
  {
    "action": "assert_visible",
    "selector": ".command-palette",
    "name": "palette is visible"
  },
  {
    "action": "screenshot",
    "name": "01-palette-open"
  },
  {
    "action": "click",
    "text": "Commands",
    "name": "switch to Commands tab"
  },
  {
    "action": "screenshot",
    "name": "02-palette-commands-tab"
  },
  {
    "action": "click",
    "text": "Snippets",
    "name": "switch to Snippets tab"
  },
  {
    "action": "screenshot",
    "name": "03-palette-snippets-tab"
  }
]
```

### Step 4 — Run the script

Ensure the correct branch is built, then run:

```bash
node scripts/qa-pr-ai.mjs <N> --steps /tmp/qa-pr-<N>-steps.json
```

The script prints screenshot paths to stdout and writes `screenshots/qa-pr-<N>/report.json`.

To use a custom output directory:
```bash
node scripts/qa-pr-ai.mjs <N> --steps /tmp/qa-pr-<N>-steps.json --screenshot-dir /tmp/qa-pr-<N>-screenshots
```

### Step 5 — Analyze screenshots

Read each screenshot file using the `Read` tool (Claude supports multimodal image reading).

For each screenshot, check:
- Does the UI state match what the PR step expected?
- Are there layout issues, missing elements, or wrong labels?
- Do failed steps (saved as `fail-NN-*.png`) show an actionable error?

Read `screenshots/qa-pr-<N>/report.json` to see which steps passed and failed programmatically.

### Step 6 — Write the QA report

Produce a Markdown report in the format defined in `agent-runbook.md` (grouped results + `Not Passed` block).

Map each Manual QA step from the PR to a result:
- `✅` if the screenshot and assertions confirm the expected behavior
- `❌` if any assertion failed or the screenshot shows incorrect UI
- `⚠️` if the step could not run (missing selector, environment blocker)

Include `screenshotPath` as the `Evidence` field for every `❌` or `⚠️` entry.

---

## Step JSON schema

All step objects share these optional fields:

| Field | Type | Description |
|---|---|---|
| `name` | string | Human-readable label; used as screenshot filename for `screenshot` action |
| `timeout` | number | Override default 5000 ms timeout |
| `screenshot_after` | string | Take a screenshot after this step, save as this name |

Action-specific fields:

### `screenshot`
Take a screenshot of the full window.
```json
{ "action": "screenshot", "name": "01-after-click" }
```

### `click`
Click by CSS selector or by visible text (use `text` when no stable selector exists).
```json
{ "action": "click", "selector": ".palette-filter-btn[data-filter='commands']" }
{ "action": "click", "text": "Commands", "exact": true }
```

### `click_role`
Click by ARIA role and accessible name.
```json
{ "action": "click_role", "role": "button", "accessible_name": "Settings" }
```

### `type`
Type text character by character (triggers `input` events per keystroke; use for search fields).
```json
{ "action": "type", "selector": ".palette-search input", "value": "/foo" }
```

### `fill`
Set value instantly (use for form fields where intermediate events don't matter).
```json
{ "action": "fill", "selector": "input[name='apiKey']", "value": "sk-test" }
```

### `press`
Press a keyboard shortcut. Uses Playwright key notation.
```json
{ "action": "press", "key": "Meta+Shift+K" }
{ "action": "press", "key": "Escape" }
{ "action": "press", "key": "ArrowDown" }
```

### `wait_for`
Wait for a selector to reach a given state (default: `visible`).
```json
{ "action": "wait_for", "selector": ".command-palette", "state": "visible" }
{ "action": "wait_for", "selector": ".loading-spinner", "state": "hidden" }
```

### `wait_ms`
Wait a fixed number of milliseconds (use after animations or async transitions).
```json
{ "action": "wait_ms", "ms": 300 }
```

### `assert_visible`
Fail the step if the selector is not visible within the timeout.
```json
{ "action": "assert_visible", "selector": ".command-palette" }
```

### `assert_text`
Fail the step if the text is not visible on the page. Optionally scope to a selector.
```json
{ "action": "assert_text", "text": "No results" }
{ "action": "assert_text", "selector": ".palette-list", "text": "No results" }
```

### `assert_count`
Fail the step if fewer than `min` elements match the selector.
```json
{ "action": "assert_count", "selector": ".palette-item", "min": 3 }
```

### `set_localStorage`
Set a localStorage key before the next interaction.
```json
{ "action": "set_localStorage", "key": "taviraq.sidebarWidth", "value": "320" }
```

### `set_viewport`
Resize the viewport (useful for responsive/narrow-width tests).
```json
{ "action": "set_viewport", "width": 320, "height": 900 }
```

### `reload`
Reload the page and wait for `.app-shell` to be visible again.
```json
{ "action": "reload" }
```

---

## Tips

- The app launches in `TAVIRAQ_DEMO_MODE=1` with a fresh `userDataDir` each run — no real keychain access, no provider API calls.
- Initial locale is set to `ru` (Russian). If a PR adds/changes labels, check for the Russian translations in `src/renderer/src/i18n/translations.ts`.
- If a selector is not found, read the built component source at `src/renderer/src/components/<Component>.tsx` to find the correct class name. The `out/` directory contains the compiled output but the source is the authoritative reference.
- The script saves `fail-NN-*.png` screenshots automatically when a step throws, even if no `screenshot` action was queued — read these first when diagnosing failures.
- Smoke-only run (no `--steps`): the script still launches the app and captures `00-initial.png` and `99-final.png`, which is useful as a sanity check that the build starts.
