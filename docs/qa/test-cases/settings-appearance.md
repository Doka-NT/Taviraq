# Settings And Appearance Test Cases

## TC-SETTINGS-001: Navigate settings tabs by click and keyboard

- Priority: P1
- Type: UI
- Sources: settings tabs, commit `ec573e1`
- Coverage: missing/partial
- Screenshot: none

Steps:
1. Open Settings.
2. Navigate between Appearance, Providers, Connections, Security, Prompts, Snippets, and Data.
3. Use keyboard navigation where supported.

Expected:
- Active tab changes correctly.
- Focus order is predictable.
- Settings close action returns to the previous workspace state.

Automation:
- Existing: none.
- Missing: UI accessibility/navigation test.

## TC-SETTINGS-002: Settings search shows matching and empty states

- Priority: P1
- Type: UI
- Sources: issue #35, PR #46, commit `25fff65`
- Coverage: missing/partial
- Screenshot: TODO under `../assets/settings-appearance/settings-search-empty.png`

Steps:
1. Open Settings.
2. Search for `proxy`.
3. Search for a nonsense value.

Expected:
- Matching settings are discoverable.
- No-result empty state is visible and useful.
- Clearing search restores full settings navigation.

Automation:
- Existing: helper coverage may exist for empty suggestions.
- Missing: UI test for settings search.

## TC-SETTINGS-003: Terminal font size validates and applies

- Priority: P1
- Type: unit, UI
- Sources: issue #31, PR #48, commit `1f12c36`
- Coverage: partial
- Screenshot: none

Steps:
1. Set font size to a valid value.
2. Try zero, negative, and non-numeric values.
3. Restart app.

Expected:
- Valid size applies to all terminal sessions.
- Invalid values are not applied.
- Preference persists across restart.

Automation:
- Existing: related localStorage guard instructions and utility coverage.
- Missing: UI/Electron preference persistence test.

## TC-SETTINGS-004: Output context size validates minimum

- Priority: P1
- Type: UI
- Sources: commit `4bcbce7`, issue #32
- Coverage: missing/partial
- Screenshot: none

Steps:
1. Open Appearance settings.
2. Set output context below minimum.
3. Set output context to a large valid value.

Expected:
- Values below minimum are rejected or clamped.
- Assistant payload estimate uses the saved value.
- Preference persists.

Automation:
- Existing: partial context utility coverage.
- Missing: UI validation test.

## TC-SETTINGS-005: Theme preference applies to UI and terminal

- Priority: P1
- Type: UI, Electron smoke
- Sources: issue #31, PR #48, theme definitions
- Coverage: missing/partial
- Screenshot: TODO under `../assets/settings-appearance/theme-selection.png`

Steps:
1. Change theme in Appearance settings.
2. Observe app chrome and terminal colors.
3. Restart Taviraq.

Expected:
- UI theme changes immediately.
- Terminal theme updates without recreating sessions.
- Selected theme persists across restart.

Automation:
- Existing: theme utility coverage if present.
- Missing: Electron smoke with visual assertion.

## TC-SETTINGS-006: Language preference updates UI and assistant language context

- Priority: P1
- Type: UI
- Sources: issue #31, translations
- Coverage: missing/partial
- Screenshot: none

Steps:
1. Switch language to Russian.
2. Switch language to Chinese.
3. Send an assistant request.

Expected:
- UI labels update.
- Assistant request language context follows selected language.
- Preference persists across restart.

Automation:
- Existing: translation type coverage through build.
- Missing: UI and payload context test.

## TC-SETTINGS-007: Sidebar resize and open handle persist

- Priority: P1
- Type: UI, Electron smoke
- Sources: README, commit `58ec0f6`
- Coverage: missing
- Screenshot: none

Steps:
1. Resize assistant sidebar.
2. Hide sidebar.
3. Reopen it using the handle.
4. Restart Taviraq.

Expected:
- Width stays within min/max constraints.
- Workspace does not collapse below minimum.
- Width persists through restart.

Automation:
- Existing: none.
- Missing: Electron smoke for resize/restore.

## TC-SETTINGS-008: Global hide/show shortcut records and rejects conflicts

- Priority: P1
- Type: Electron smoke, manual
- Sources: `shortcut:*` IPC, globalShortcut handling
- Coverage: missing
- Screenshot: none

Steps:
1. Start shortcut recording.
2. Enter an available shortcut.
3. Try a conflicting system shortcut.

Expected:
- Available shortcut toggles window visibility.
- Conflicting shortcut shows conflict message and does not replace working shortcut.
- Recording can be cancelled.

Automation:
- Existing: none.
- Missing: Electron smoke with mocked globalShortcut; manual macOS validation.

## TC-SETTINGS-009: About shows version and homepage

- Priority: P1
- Type: Electron smoke
- Sources: issue #42, PR #45
- Coverage: missing
- Screenshot: TODO for About window

Steps:
1. Open About.
2. Check version and homepage link.
3. Click homepage.

Expected:
- Version reflects `app.getVersion()`.
- Homepage is visible and opens externally.
- No unsafe markup is rendered.

Automation:
- Existing: none.
- Missing: Electron smoke for About content and link.

## TC-SETTINGS-010: About dismisses cleanly and uses app icon

- Priority: P1
- Type: Electron smoke
- Sources: issue #50, PR #51
- Coverage: missing
- Screenshot: TODO for About icon

Steps:
1. Open About.
2. Dismiss with close button and keyboard.
3. Reopen About.

Expected:
- About closes without leaving overlay/window artifacts.
- App icon is displayed correctly.
- Reopening works.

Automation:
- Existing: none.
- Missing: Electron smoke for dismissal.

