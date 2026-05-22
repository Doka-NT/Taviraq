# Prompts And Snippets Test Cases

## TC-PROMPT-001: Create, edit, and delete a prompt

- Priority: P1
- Type: unit, UI
- Sources: PromptStore, Settings Prompts
- Coverage: partial
- Screenshot: none

Steps:
1. Create a prompt with name and content.
2. Edit its content.
3. Delete it.

Expected:
- Prompt is saved as Markdown-backed data.
- Edited content persists.
- Delete removes the prompt without affecting other prompts.

Automation:
- Existing: `tests/unit/promptStore.test.ts`.
- Missing: UI CRUD test.

## TC-PROMPT-002: Import prompt from Markdown file

- Priority: P1
- Type: unit, Electron smoke
- Sources: `prompt:import`, PromptStore tests
- Coverage: partial
- Screenshot: none

Steps:
1. Import a plain Markdown prompt file.
2. Import a Markdown prompt with JSON frontmatter.

Expected:
- Plain file uses filename as prompt name.
- Frontmatter metadata is parsed.
- Empty or non-Markdown files are skipped.

Automation:
- Existing: `tests/unit/promptStore.test.ts`.
- Missing: Electron smoke with mocked open dialog.

## TC-PROMPT-003: Duplicate prompt name is rejected

- Priority: P1
- Type: UI
- Sources: commit `ec5e1a5`, prompt settings strings
- Coverage: missing
- Screenshot: none

Steps:
1. Create a prompt named `Deploy`.
2. Try to create another prompt named `Deploy`.

Expected:
- Duplicate warning is shown.
- Existing prompt is not overwritten accidentally.
- Save action remains disabled or rejected until name changes.

Automation:
- Existing: none.
- Missing: UI validation test.

## TC-PROMPT-004: Summarize conversation into prompt

- Priority: P1
- Type: unit, UI
- Sources: commits `b5cc73c`, `ad5a1d9`
- Coverage: partial
- Screenshot: none

Steps:
1. Create a chat with several messages.
2. Request prompt generation from the conversation.
3. Save generated prompt.

Expected:
- Summary request uses current chat messages.
- Generated prompt has name and content.
- Saved prompt appears in prompt library.

Automation:
- Existing: service-level summarize request paths.
- Missing: UI flow test.

## TC-PROMPT-005: Cancel prompt generation

- Priority: P1
- Type: UI
- Sources: commit `08ed875`, `llm:cancelSummarizeConversation`
- Coverage: partial
- Screenshot: none

Steps:
1. Start conversation summarization.
2. Cancel before completion.

Expected:
- Request is cancelled by request ID.
- UI leaves loading state.
- No partial prompt is saved automatically.

Automation:
- Existing: cancellation path in service.
- Missing: UI cancellation test.

## TC-SNIPPET-001: Create, edit, and delete command snippet

- Priority: P1
- Type: unit, UI
- Sources: commit `e4d0968`, `commandSnippet` preload API
- Coverage: partial
- Screenshot: none

Steps:
1. Create a snippet with name and command.
2. Edit the command.
3. Delete the snippet.

Expected:
- Snippet persists with timestamps.
- Edited command appears in snippet list.
- Delete removes only selected snippet.

Automation:
- Existing: store behavior covered where command snippet store tests exist or should be added.
- Missing: UI CRUD test.

## TC-SNIPPET-002: Duplicate snippet name is rejected

- Priority: P1
- Type: UI
- Sources: commit `ec5e1a5`
- Coverage: missing
- Screenshot: none

Steps:
1. Create a snippet named `List`.
2. Try to create another snippet named `List`.

Expected:
- Duplicate name warning is shown.
- Original snippet remains unchanged.
- User can save after choosing a unique name.

Automation:
- Existing: none.
- Missing: UI validation test.

## TC-SNIPPET-003: Quick snippet palette searches snippets

- Priority: P1
- Type: UI, Electron smoke
- Sources: snippet palette UI, shortcut `Cmd+Shift+K`
- Coverage: missing
- Screenshot: TODO for palette state

Steps:
1. Create multiple snippets.
2. Open quick snippet palette.
3. Search by partial name or command.

Expected:
- Matching snippets are shown.
- Empty and no-match states are clear.
- Add snippet CTA opens snippet settings/form.

Automation:
- Existing: none.
- Missing: UI test for palette search.

## TC-SNIPPET-004: Enter inserts snippet without running

- Priority: P0
- Type: UI, Electron smoke
- Sources: snippet palette strings, `insertCommandSnippet`
- Coverage: missing
- Screenshot: none

Steps:
1. Open snippet palette.
2. Select a snippet.
3. Press Enter.

Expected:
- Command text is inserted into terminal input.
- Command is not submitted.
- User can edit before running.

Automation:
- Existing: none.
- Missing: Electron smoke for terminal write without carriage return.

## TC-SNIPPET-005: Cmd+Enter runs snippet immediately

- Priority: P0
- Type: UI, Electron smoke
- Sources: snippet palette strings, `insertCommandSnippet`
- Coverage: missing
- Screenshot: none

Steps:
1. Open snippet palette.
2. Select a safe snippet.
3. Press Cmd+Enter.

Expected:
- Command is written with submit/newline.
- Terminal command event is captured.
- Risky snippet execution should still use command safety where applicable.

Automation:
- Existing: none.
- Missing: Electron smoke for run action.

