# Data Import And Export Test Cases

## TC-DATA-001: Export data without secrets

- Priority: P0
- Type: Electron smoke, manual
- Sources: `ExportData`, docs/security-privacy.md
- Coverage: missing/partial
- Screenshot: none

Steps:
1. Configure providers, prompts, snippets, SSH profiles, and preferences.
2. Run export.
3. Choose not to include keys.
4. Inspect exported JSON.

Expected:
- Export contains config, prompts, snippets, SSH profiles, and preferences.
- Raw API keys and proxy passwords are absent.
- Export version and timestamp are present.

Automation:
- Existing: type coverage.
- Missing: integration/Electron export test with mocked dialogs.

## TC-DATA-002: Export data with explicitly included secrets

- Priority: P0
- Type: manual
- Sources: `data:export`, keychain storage
- Coverage: missing/manual
- Screenshot: none

Steps:
1. Save provider API key and proxy password.
2. Export and explicitly choose to include secrets.
3. Inspect exported JSON in a safe local environment.

Expected:
- Secrets are included only after explicit confirmation.
- Missing keychain entries are handled without crashing.
- No secrets are printed to logs.

Automation:
- Existing: none.
- Missing: manual keychain QA; automated test can mock SecretStore.

## TC-DATA-003: Import merges without overwriting existing items

- Priority: P0
- Type: integration, Electron smoke
- Sources: import handler, `ImportResult`
- Coverage: missing/partial
- Screenshot: none

Steps:
1. Prepare existing provider, prompt, snippet, and SSH profile.
2. Import JSON containing one duplicate and one new item for each category.

Expected:
- New items are added.
- Existing items are skipped or preserved according to merge rules.
- Import result counts added items correctly.
- Preferences are returned for renderer application.

Automation:
- Existing: none or partial store coverage.
- Missing: import handler integration test.

## TC-DATA-004: Danger zone actions require confirmation

- Priority: P1
- Type: UI
- Sources: commit `b1d0287`, Data settings
- Coverage: missing
- Screenshot: TODO for danger zone

Steps:
1. Open Settings > Data.
2. Clear saved session state.
3. Clear chat history.

Expected:
- Each destructive action requires confirmation.
- Current open tabs are not closed by clearing saved session state.
- Chat history clear reports completion.

Automation:
- Existing: stores have direct clear APIs.
- Missing: UI confirmation tests.

