# Terminal Core Test Cases

## TC-TERMINAL-001: Create and use a local terminal session

- Priority: P0
- Type: integration, Electron smoke
- Sources: README, `TerminalManager`, `preload.terminal`, `tests/integration/pty.test.ts`
- Coverage: partial
- Screenshot: none

Steps:
1. Launch Taviraq.
2. Create a new local terminal tab.
3. Run `echo taviraq`.
4. Close the tab.

Expected:
- A local terminal tab is created and becomes active.
- `taviraq` appears in terminal output.
- Closing the tab removes the session without leaving an invalid active tab.

Automation:
- Existing: `tests/integration/pty.test.ts` covers PTY output and exit.
- Missing: Electron smoke for real UI tab creation and close.

## TC-TERMINAL-002: Resize terminal propagates dimensions to PTY

- Priority: P1
- Type: integration, Electron smoke
- Sources: `TerminalPane`, `terminal:resize`, xterm fit handling
- Coverage: missing
- Screenshot: none

Steps:
1. Launch Taviraq with a local terminal.
2. Resize the app window or sidebar.
3. Run `stty size`.

Expected:
- Terminal content refits without overlap.
- PTY receives updated rows and columns.
- New prompt remains visible and interactive.

Automation:
- Existing: none.
- Missing: integration test around `terminal:resize`; Electron smoke for window/sidebar resize.

## TC-TERMINAL-003: Terminal output buffer keeps newest scrollback

- Priority: P1
- Type: unit, UI
- Sources: session state helpers, output buffer trimming
- Coverage: partial
- Screenshot: none

Steps:
1. Produce terminal output longer than the configured maximum buffer.
2. Save session state.
3. Inspect restored output.

Expected:
- Oldest content is trimmed.
- Newest output and prompt context remain available.
- Command block metadata is not kept when buffer trimming makes offsets stale.

Automation:
- Existing: `tests/unit/sessionStateStore.test.ts`.
- Missing: UI-level restore check with large scrollback.

## TC-TERMINAL-004: Switch tabs with keyboard and mouse

- Priority: P0
- Type: UI, Electron smoke
- Sources: `AppShortcutAction`, `App.tsx`, README tabs highlight
- Coverage: missing
- Screenshot: none

Steps:
1. Create three local terminal tabs.
2. Switch tabs by clicking each tab.
3. Use next-tab shortcut.
4. Use numeric tab shortcut for tab 1 and tab 2.

Expected:
- Active tab changes correctly.
- Terminal focus returns to the selected session.
- Output buffers do not leak between sessions.

Automation:
- Existing: none.
- Missing: UI/Electron smoke for tab switching.

## TC-TERMINAL-005: Closing active and inactive tabs preserves valid selection

- Priority: P0
- Type: UI, Electron smoke
- Sources: `App.tsx` close session flow
- Coverage: missing
- Screenshot: none

Steps:
1. Create at least three tabs.
2. Close an inactive tab.
3. Close the active tab.
4. Close tabs until only one remains.

Expected:
- Inactive close does not change the active tab unexpectedly.
- Active close selects a neighboring available tab.
- The app never shows an empty broken workspace.

Automation:
- Existing: none.
- Missing: UI test for close behavior.

## TC-TERMINAL-006: Cursor remains visible after tab switch

- Priority: P0
- Type: UI, Electron smoke
- Sources: issue #9, PR #10, terminal output utility
- Coverage: partial
- Screenshot: TODO, optional regression reference

Steps:
1. Open two terminal tabs.
2. Type partial input in tab 1.
3. Switch to tab 2 and back to tab 1.

Expected:
- Cursor is visible in the restored terminal.
- Partial input remains intact.
- Terminal stays focused and accepts typing.

Automation:
- Existing: `tests/unit/terminalOutput.test.ts`.
- Missing: Electron smoke for real tab switching.

## TC-TERMINAL-007: Alternate buffer output restores safely

- Priority: P1
- Type: unit, Electron smoke
- Sources: commit `84b666e`, `TerminalPane`
- Coverage: partial
- Screenshot: none

Steps:
1. Run a TUI-style command that uses alternate screen buffer.
2. Exit the command.
3. Switch tabs and return.

Expected:
- Main buffer output is replayed correctly.
- Cursor visibility is restored.
- No stale alternate-buffer content overlays the prompt.

Automation:
- Existing: unit coverage for output cursor restoration.
- Missing: Electron smoke with a real TUI command.

## TC-TERMINAL-008: Search terminal output

- Priority: P1
- Type: UI, Electron smoke
- Sources: commit `2ae5b76`, `TerminalPane`, terminal search shortcut
- Coverage: missing
- Screenshot: TODO for search panel visual state

Steps:
1. Produce output containing a unique word.
2. Open terminal search.
3. Search for the word.
4. Search for a missing word.

Expected:
- Existing word is found and highlighted.
- Missing word shows a clear no-result state.
- Search focus and close behavior do not steal terminal input after close.

Automation:
- Existing: none.
- Missing: UI/Electron smoke for xterm search addon.

## TC-TERMINAL-009: Terminal URLs are clickable

- Priority: P1
- Type: Electron smoke, manual
- Sources: issue #1, PR #2, xterm web links addon
- Coverage: missing
- Screenshot: none

Steps:
1. Print `https://taviraq.dev` in the terminal.
2. Click the URL.

Expected:
- Link is detected as a web link.
- Taviraq asks Electron to open the external URL.
- Terminal content is not modified.

Automation:
- Existing: none.
- Missing: Electron smoke with mocked `shell.openExternal`.

## TC-TERMINAL-010: Select a single command block

- Priority: P1
- Type: unit, UI
- Sources: command block utilities, commit `f86b92d`
- Coverage: partial
- Screenshot: none

Steps:
1. Run a command that produces multiple output lines.
2. Select its command block in the terminal block UI.
3. Copy or ask assistant about the block.

Expected:
- Selected block includes the command and its output.
- Prompt echo is not duplicated.
- The selected block maps to the correct session.

Automation:
- Existing: `tests/unit/terminalBlocks.test.ts`.
- Missing: UI interaction around block selection.

## TC-TERMINAL-011: Select multiline command block

- Priority: P0
- Type: unit, UI
- Sources: issue #19, PR #20
- Coverage: partial
- Screenshot: none

Steps:
1. Run a multiline shell command.
2. Select the resulting command block.
3. Copy the block text.

Expected:
- Full multiline command is recognized.
- Output starts after the echoed command.
- Block selection does not drift to an adjacent command.

Automation:
- Existing: `tests/unit/terminalBlocks.test.ts`.
- Missing: UI test for multiline block controls.

## TC-TERMINAL-012: Rerun a terminal command block

- Priority: P1
- Type: UI, Electron smoke
- Sources: commit `9fd876c`, confirmation modal
- Coverage: missing
- Screenshot: none

Steps:
1. Run a harmless command.
2. Open the block action menu.
3. Choose rerun.
4. Confirm execution if required.

Expected:
- The original command is written to the active session.
- Risky commands still require confirmation.
- Rerun output is tracked as a new command block.

Automation:
- Existing: none.
- Missing: UI smoke for block rerun.

