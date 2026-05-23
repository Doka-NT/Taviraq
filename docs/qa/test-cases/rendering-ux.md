# Rendering And UX Test Cases

## TC-RENDER-001: Markdown headings render without literal hashes

- Priority: P2
- Type: UI
- Sources: commit `2dc4e13`, MessageContent tests
- Coverage: existing
- Screenshot: none

Steps:
1. Render assistant content with Markdown headings.

Expected:
- Heading text is styled as a heading.
- Leading hash markers are not displayed as plain text.

Automation:
- Existing: `tests/ui/messageContent.test.tsx`.
- Missing: none.

## TC-RENDER-002: Markdown tables render with numeric mini-bars

- Priority: P2
- Type: UI
- Sources: redesign helpers, MessageContent tests
- Coverage: existing/partial
- Screenshot: TODO for table visual reference

Steps:
1. Render assistant content with a table containing numeric values.

Expected:
- Table is rendered as a real table.
- Numeric columns get mini-bar summary where applicable.
- Non-numeric tables remain readable.

Automation:
- Existing: `tests/ui/messageContent.test.tsx`, `tests/unit/redesign.test.ts`.
- Missing: visual regression screenshot if needed.

## TC-RENDER-003: Shell command code blocks render runnable action pills

- Priority: P1
- Type: UI
- Sources: MessageContent, command proposal extraction, issue #56
- Coverage: existing/partial
- Screenshot: none

Steps:
1. Render assistant response with fenced `sh` command.
2. Render response with non-shell code block.
3. Render response with an unlabeled fenced text block.
4. Render response with a multiline fenced shell command.

Expected:
- Shell command renders as runnable action.
- Non-shell code block is not offered as a terminal command.
- Unlabeled fenced text is displayed as code, not as a runnable terminal command.
- Long or multiline code content remains viewable through scrolling or expansion instead of being permanently truncated.
- Display redaction does not alter underlying runnable command unexpectedly.

Automation:
- Existing: `tests/ui/messageContent.test.tsx`, `tests/unit/commandProposals.test.ts`.
- Missing: integration with terminal write.

## TC-RENDER-004: Empty chat state offers useful next actions

- Priority: P2
- Type: UI
- Sources: issue #26, empty-state commits
- Coverage: missing/partial
- Screenshot: TODO for empty chat

Steps:
1. Launch with no chat messages.
2. Open assistant panel.

Expected:
- Empty state is readable.
- Suggested actions match available context.
- CTA does not imply provider connectivity if provider is missing.

Automation:
- Existing: redesign helper tests.
- Missing: UI empty state test.

## TC-RENDER-005: Prompt, snippet, and history empty states include CTAs

- Priority: P2
- Type: UI
- Sources: commits `1c8a133`, `e857cdc`
- Coverage: missing
- Screenshot: TODO for each empty state if visually reviewed

Steps:
1. Clear prompts, snippets, and chat history.
2. Open each corresponding view.

Expected:
- Each empty state explains what is missing.
- CTA opens the correct creation flow.
- Empty state does not take excessive space in compact sidebar.

Automation:
- Existing: none.
- Missing: UI empty state tests.

## TC-RENDER-006: Buttons expose accessible labels

- Priority: P1
- Type: UI
- Sources: commit `5b35024`
- Coverage: missing/partial
- Screenshot: none

Steps:
1. Inspect icon-only buttons in app bar, tab bar, settings, snippets, and prompts.

Expected:
- Icon-only buttons have `aria-label` or accessible title.
- Labels match action.
- Disabled states remain perceivable.

Automation:
- Existing: build/type coverage only.
- Missing: accessibility queries in UI tests.

## TC-RENDER-007: Settings keyboard navigation remains usable

- Priority: P1
- Type: UI
- Sources: commit `ec573e1`
- Coverage: missing
- Screenshot: none

Steps:
1. Open Settings.
2. Navigate with Tab, Shift+Tab, arrow keys where implemented, Enter, and Escape.

Expected:
- Focus order follows visible layout.
- Keyboard can reach critical controls.
- Escape/close behavior is predictable.

Automation:
- Existing: none.
- Missing: UI keyboard navigation test.

## TC-RENDER-008: Assistant messages and code blocks can be copied

- Priority: P1
- Type: UI
- Sources: issue #62, `MessageContent`, `LlmPanel`
- Coverage: partial
- Screenshot: none

Steps:
1. Render or receive an assistant response containing regular Markdown text and at least one fenced non-shell code block.
2. Click the assistant message copy action.
3. Click the copy action inside the fenced code block.
4. Repeat with a fenced shell command that contains a masked secret placeholder in display.

Expected:
- Assistant messages expose a copy action with an accessible label.
- Fenced code blocks expose their own copy action separate from run/expand controls.
- Copy actions write the displayed assistant text or displayed code block text to the clipboard.
- Copy actions show brief success feedback.
- Shell code copy does not alter the runnable command path, and masked display content is copied as displayed.

Automation:
- Existing: `tests/ui/messageContent.test.tsx` covers non-shell code copy, shell code copy, success feedback, and displayed redaction.
- Missing: full `LlmPanel` integration coverage for the assistant message-level copy action.
