# Assistant Test Cases

## TC-ASSIST-001: Ask assistant in read mode with selected text

- Priority: P0
- Type: UI, Electron smoke
- Sources: README, docs/security-privacy.md, `LlmPanel`
- Coverage: partial
- Screenshot: none

Steps:
1. Select terminal output text.
2. Set assistant mode to read.
3. Ask the assistant to explain the selection.

Expected:
- Request includes selected text according to context settings.
- Terminal is not modified.
- Assistant response streams into the chat.

Automation:
- Existing: utility tests cover some context shaping.
- Missing: Electron smoke for selected terminal text flow.

## TC-ASSIST-002: Agent mode proposes one command at a time

- Priority: P0
- Type: UI, Electron smoke
- Sources: README, `LlmPanel`, AGENTS project brief
- Coverage: partial
- Screenshot: none

Steps:
1. Enable agent mode.
2. Ask for a next troubleshooting command.
3. Return a mocked assistant response with one fenced shell command.

Expected:
- Taviraq extracts one command proposal.
- Command safety runs before writing to terminal.
- The agent does not batch multiple unapproved commands.

Automation:
- Existing: `tests/unit/commandProposals.test.ts`.
- Missing: UI flow from assistant response to safety gate.

## TC-ASSIST-003: Recent output context respects configured size

- Priority: P1
- Type: unit, UI
- Sources: issue #32, output context settings
- Coverage: partial
- Screenshot: none

Steps:
1. Set output context size.
2. Produce terminal output larger than that size.
3. Ask the assistant about recent output.

Expected:
- Context includes only bounded recent output.
- Composer estimate reflects the configured bound.
- No stale output from other sessions is included.

Automation:
- Existing: related coverage in assistant/context utilities.
- Missing: UI assertion for displayed estimate.

## TC-ASSIST-004: No-context mode omits terminal content

- Priority: P0
- Type: unit, UI
- Sources: docs/security-privacy.md, assistant context modes
- Coverage: partial
- Screenshot: none

Steps:
1. Choose no terminal context.
2. Ask a generic assistant question.
3. Inspect mocked provider payload.

Expected:
- Selected text and terminal output are not sent.
- Session metadata is limited to non-sensitive context if used.
- Chat still works without terminal context.

Automation:
- Existing: partial context utilities.
- Missing: UI/provider payload integration test.

## TC-ASSIST-005: Streaming chat renders chunks, reasoning, and done state

- Priority: P1
- Type: unit, UI
- Sources: commit `c85d744`, `llmProtocol`, `ChatStreamEvent`
- Coverage: partial
- Screenshot: none

Steps:
1. Mock chat stream with content chunks.
2. Include a reasoning event.
3. Finish with done.

Expected:
- Content is appended in order.
- Reasoning is shown separately from final content.
- Loading state clears after done.

Automation:
- Existing: `tests/unit/llmProtocol.test.ts`.
- Missing: UI streaming rendering test.

## TC-ASSIST-006: Cancel active assistant stream

- Priority: P1
- Type: unit, UI
- Sources: `llm:cancelChatStream`, stream request IDs
- Coverage: partial
- Screenshot: none

Steps:
1. Start a long assistant stream.
2. Click stop/cancel.
3. Send a late stream chunk from the old request.

Expected:
- Active request is cancelled.
- Late chunks for old request are ignored.
- Composer becomes usable again.

Automation:
- Existing: service-level cancellation paths.
- Missing: UI cancellation regression test.

## TC-ASSIST-007: Regenerate does not prefill assistant text as user input

- Priority: P0
- Type: unit, UI
- Sources: issue #18, PR #21
- Coverage: partial
- Screenshot: none

Steps:
1. Create a chat ending with an assistant response.
2. Click regenerate.
3. Observe composer contents.

Expected:
- Previous assistant message is removed or regenerated.
- Assistant text is not copied into the user composer.
- Request history ends with the intended user message.

Automation:
- Existing: `tests/unit/chatMessages.test.ts`.
- Missing: UI click test for regenerate.

## TC-ASSIST-008: Regenerated agent response auto-runs safe command

- Priority: P0
- Type: UI, Electron smoke
- Sources: issue #54, PR #55, `LlmPanel`
- Coverage: partial
- Screenshot: none

Steps:
1. Enable agent mode with a live terminal session.
2. Create or restore a chat where the last assistant response is an error.
3. Click regenerate and return a mocked assistant response with one safe fenced shell command.

Expected:
- Previous assistant message is removed or regenerated.
- The composer is not prefilled with assistant text.
- If the active session is live, the regenerated command enters the normal agent execution flow automatically.
- If the active session is disconnected, the command remains a manual runnable block and the user sees a disconnected-session status.

Automation:
- Existing: none.
- Missing: persistent UI regression test for regenerate-to-agent execution.
- Manual evidence: PR #55 Electron smoke covered the live-session auto-run path in demo mode.

## TC-ASSIST-009: Fork message creates a usable alternate conversation

- Priority: P1
- Type: UI
- Sources: commit `b1cf874`
- Coverage: missing
- Screenshot: none

Steps:
1. Create a multi-message chat.
2. Fork from an earlier message.
3. Send a new message in the forked path.

Expected:
- Forked history includes messages up to the fork point.
- Later original messages do not leak into the fork.
- Active chat remains tied to the current terminal session.

Automation:
- Existing: none.
- Missing: UI test for fork action.

## TC-ASSIST-010: Composer shows mode, context, and payload indicators

- Priority: P1
- Type: UI, Electron smoke
- Sources: issue #32, PR #44
- Coverage: partial
- Screenshot: TODO under `../assets/assistant/composer-indicators.png`

Steps:
1. Toggle read/agent/off modes.
2. Change terminal context mode.
3. Change output context size.

Expected:
- Composer indicator labels update immediately.
- Estimated payload is bounded.
- Disabled/off state is visibly distinct from active modes.

Automation:
- Existing: some utility coverage.
- Missing: visual UI test.

## TC-ASSIST-011: First-run activation guides provider setup

- Priority: P1
- Type: UI, Electron smoke
- Sources: issue #26, PR #37
- Coverage: missing
- Screenshot: TODO for first-run state

Steps:
1. Launch Taviraq with no providers configured.
2. Open the assistant panel.
3. Follow the activation call to action.

Expected:
- Empty state explains what is needed without implying protection or connectivity.
- CTA opens provider setup.
- Assistant cannot send a request until provider setup is valid.

Automation:
- Existing: none.
- Missing: Electron smoke for first-run state.

## TC-ASSIST-012: Streaming autoscroll pauses when user reads earlier text

- Priority: P1
- Type: UI, Electron smoke
- Sources: issue #58, `LlmPanel`
- Coverage: partial
- Screenshot: none

Steps:
1. Send a prompt that produces a streaming assistant response longer than one chat viewport.
2. Do not touch the chat scroll while the response streams.
3. During the same stream, scroll upward to read earlier text.
4. Scroll back to the bottom while the response is still streaming.

Expected:
- While untouched, the chat follows new streamed content at the bottom.
- After manual upward scroll, new chunks do not force the viewport back to the bottom.
- After manually returning to the bottom, autoscroll resumes for later chunks.

Automation:
- Existing: `tests/ui/llmPanel.test.tsx` covers bottom-threshold detection for pause/resume.
- Missing: Electron smoke with a mocked long streaming response.

## TC-ASSIST-013: Streaming response preserves final text and markdown

- Priority: P0
- Type: unit, UI
- Sources: issue #57, `llmService`, `llmProtocol`, `LlmPanel`
- Coverage: partial
- Screenshot: none

Steps:
1. Mock a provider stream that returns Cyrillic text and a markdown list.
2. End the final provider event without an extra blank SSE delimiter or newline.
3. Wait for the assistant response to finish rendering.

Expected:
- The final assistant message contains every streamed character in order.
- Cyrillic words are not truncated or merged.
- Markdown list item boundaries and line breaks are preserved.

Automation:
- Existing: `tests/unit/llmService.test.ts` covers unterminated final stream chunks for OpenAI-compatible, Anthropic, LM Studio, and Ollama providers.
- Missing: UI streaming rendering test for the same provider-tail scenario.
