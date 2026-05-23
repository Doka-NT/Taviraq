# Command Palette And Shortcut Test Cases

## TC-PALETTE-001: Open unified command palette

- Priority: P1
- Type: UI, Electron smoke
- Sources: issue #34, PR #43
- Coverage: missing
- Screenshot: TODO under `../assets/command-palette/palette-open.png`

Steps:
1. Launch Taviraq with at least one terminal session.
2. Open the unified command palette with its shortcut or UI entry.

Expected:
- Palette opens above the current workspace.
- Search input is focused.
- Current terminal session remains unchanged until an action is selected.

Automation:
- Existing: none.
- Missing: UI/Electron smoke for palette opening.

## TC-PALETTE-002: Search and execute navigation actions

- Priority: P1
- Type: UI
- Sources: issue #34, PR #43, `AppShortcutAction`
- Coverage: missing
- Screenshot: none

Steps:
1. Open the command palette.
2. Search for Settings.
3. Execute the settings action.
4. Reopen palette and search for Prompt Library.

Expected:
- Search filters relevant actions.
- Settings action opens Settings.
- Prompt Library action opens prompt library without corrupting active terminal input.

Automation:
- Existing: none.
- Missing: UI command execution test.

## TC-PALETTE-003: Empty command palette search shows no-result state

- Priority: P2
- Type: UI
- Sources: issue #34, settings empty-state work
- Coverage: missing
- Screenshot: TODO under `../assets/command-palette/palette-empty.png`

Steps:
1. Open command palette.
2. Search for a string with no matches.

Expected:
- No-result state is visible.
- Palette remains open and editable.
- Clearing search restores the action list.

Automation:
- Existing: none.
- Missing: UI no-result test.

## TC-PALETTE-004: Shortcut actions route to the same product behavior as buttons

- Priority: P1
- Type: UI, Electron smoke
- Sources: `AppShortcutAction`, `main/index.ts`, `App.tsx`
- Coverage: missing/partial
- Screenshot: none

Steps:
1. Trigger new-tab, close-tab, toggle-sidebar, open-settings, and next-tab via shortcuts.
2. Trigger the equivalent UI buttons.

Expected:
- Shortcut and button paths produce the same state changes.
- Shortcuts do not fire while focus is inside modal text fields where inappropriate.
- No shortcut leaves the app in a half-open modal/palette state.

Automation:
- Existing: none.
- Missing: Electron smoke for app shortcut events.

## TC-PALETTE-005: Palette does not intercept terminal-reserved shortcuts

- Priority: P1
- Type: UI, Electron smoke
- Sources: PR #43 follow-ups, terminal shortcut behavior
- Coverage: missing
- Screenshot: none

Steps:
1. Focus the terminal.
2. Use terminal-reserved shortcuts such as clear/search according to current product mapping.
3. Open and close command palette.
4. Repeat terminal shortcut.

Expected:
- Terminal-reserved shortcuts continue to work in terminal context.
- Palette shortcuts are active only in intended contexts.
- Closing palette restores terminal focus.

Automation:
- Existing: none.
- Missing: Electron shortcut regression test.

## TC-PALETTE-006: Switch model command opens model picker

- Priority: P1
- Type: UI, Electron smoke
- Sources: issue #66
- Coverage: missing/partial
- Screenshot: TODO under `../assets/command-palette/model-switcher.png`

Steps:
1. Configure a provider with at least two chat models.
2. Open the command palette.
3. Search for "Switch model" and run the action.
4. Filter the model list and select a different model.

Expected:
- The assistant sidebar opens if it was hidden.
- A filterable model picker appears with models from the current provider only.
- Selecting a model updates the composer model chip.
- Existing chat messages and terminal context remain in place.

Automation:
- Existing: none.
- Missing: UI/Electron smoke for command-palette model switching.
