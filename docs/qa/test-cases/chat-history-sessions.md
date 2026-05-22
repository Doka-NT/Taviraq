# Chat History And Session State Test Cases

## TC-SESSION-001: Restore local terminal tabs on launch

- Priority: P0
- Type: integration, Electron smoke
- Sources: `SessionStateSnapshot`, `sessionState:load/save`
- Coverage: partial
- Screenshot: none

Steps:
1. Open two local tabs.
2. Produce output in each.
3. Quit and relaunch.

Expected:
- Local tabs are restored.
- Recent output is replayed.
- Active tab is restored when possible.

Automation:
- Existing: `tests/unit/sessionStateStore.test.ts`.
- Missing: Electron smoke for launch restore.

## TC-SESSION-002: Missing cwd falls back safely

- Priority: P1
- Type: unit, Electron smoke
- Sources: `resolveExistingCwd`, restore fallback notices
- Coverage: partial
- Screenshot: none

Steps:
1. Save session with cwd that no longer exists.
2. Relaunch Taviraq.

Expected:
- New shell opens in fallback cwd.
- User sees a notice explaining the fallback.
- Restore does not fail globally.

Automation:
- Existing: `tests/unit/cwd.test.ts`.
- Missing: Electron restore smoke.

## TC-SESSION-003: Clear saved session state keeps current tabs open

- Priority: P1
- Type: UI, integration
- Sources: Data settings strings
- Coverage: missing/partial
- Screenshot: none

Steps:
1. Open tabs and produce output.
2. Clear saved session state from Settings > Data.
3. Continue using current tabs.
4. Restart app.

Expected:
- Current tabs remain open after clear.
- Saved restore data is removed.
- Relaunch starts fresh or according to default behavior.

Automation:
- Existing: session state store clear API.
- Missing: UI scenario test.

## TC-CHAT-001: Save and list chat history

- Priority: P1
- Type: integration, UI
- Sources: `chatHistory:*` preload API
- Coverage: missing/partial
- Screenshot: none

Steps:
1. Send a chat message and receive response.
2. Save chat history.
3. Open history list.

Expected:
- Chat appears with title, message count, timestamps, provider/model metadata where available.
- Selecting the item loads messages.
- Session snapshot is preserved if present.

Automation:
- Existing: store behavior may need coverage.
- Missing: UI history list test.

## TC-CHAT-002: Delete one saved chat

- Priority: P1
- Type: integration, UI
- Sources: `chatHistory:delete`
- Coverage: missing
- Screenshot: none

Steps:
1. Save two chats.
2. Delete one chat.
3. Reopen history list.

Expected:
- Deleted chat is gone.
- Other chat remains.
- Deleting missing chat does not crash.

Automation:
- Existing: none.
- Missing: chat history store and UI tests.

## TC-CHAT-003: Clear all chat history

- Priority: P1
- Type: UI
- Sources: Data settings, `chatHistory:clear`
- Coverage: missing
- Screenshot: none

Steps:
1. Save at least one chat.
2. Open Settings > Data.
3. Clear chat history and confirm.

Expected:
- All saved chats are removed.
- Current in-memory conversation behavior is clear and intentional.
- Completion status is shown.

Automation:
- Existing: none.
- Missing: UI confirmation and store tests.

