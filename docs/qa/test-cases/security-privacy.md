# Security And Privacy Test Cases

## TC-PRIVACY-001: Provider payload masking removes raw secrets

- Priority: P0
- Type: unit, UI
- Sources: issue #14, PR #16, docs/security-privacy.md
- Coverage: partial
- Screenshot: none

Steps:
1. Enable secret masking and provider payload scope.
2. Include `OPENAI_API_KEY=sk-test-secret` in terminal context.
3. Send assistant request with mocked provider.

Expected:
- Raw secret is absent from provider payload.
- Placeholder or masked value is sent instead.
- Privacy event reports masked secret count.

Automation:
- Existing: `tests/unit/secretMasking.test.ts`, `tests/unit/llmService.test.ts`.
- Missing: UI/provider integration assertion.

## TC-PRIVACY-002: Masking off does not scan provider payloads

- Priority: P1
- Type: unit
- Sources: secret masking settings, tests
- Coverage: existing
- Screenshot: none

Steps:
1. Disable secret masking.
2. Send assistant request with token-like text.

Expected:
- Scanner work is skipped.
- Payload is not rewritten by masking utilities.
- UI should not claim protection is active.

Automation:
- Existing: `tests/unit/secretMasking.test.ts`, `tests/unit/llmService.test.ts`.
- Missing: UI no-protection visual smoke.

## TC-PRIVACY-003: Chat display masks assistant-visible secrets

- Priority: P0
- Type: unit, UI
- Sources: PR #49, docs/security-privacy.md
- Coverage: partial
- Screenshot: TODO under `../assets/security-privacy/chat-display-masked.png`

Steps:
1. Enable chat display masking.
2. Produce command output containing a secret.
3. Show that output in chat.

Expected:
- Raw secret is not visible in chat.
- Masked placeholder is visible.
- Runnable command data is not accidentally corrupted unless it is display-only.

Automation:
- Existing: `tests/unit/secretMasking.test.ts`, `tests/ui/messageContent.test.tsx`.
- Missing: UI state with live chat output.

## TC-PRIVACY-004: Saved chat history redacts raw scanned secrets

- Priority: P0
- Type: unit, integration
- Sources: docs/security-privacy.md, secret masking tests
- Coverage: existing/partial
- Screenshot: none

Steps:
1. Enable display masking.
2. Save a chat containing raw command output with a secret.
3. Reload chat history.

Expected:
- Raw secret is absent from saved chat content.
- Reloaded chat displays masked content.
- Audit/status messages do not reveal placeholder bindings.

Automation:
- Existing: `tests/unit/secretMasking.test.ts`.
- Missing: integration test through chat history store.

## TC-PRIVACY-005: Strict terminal context hides output from provider continuation

- Priority: P0
- Type: UI
- Sources: `strictTerminalContext`, `llmPanel.test.tsx`
- Coverage: partial
- Screenshot: none

Steps:
1. Enable strict terminal context.
2. Run an agent command that produces output.
3. Continue assistant loop.

Expected:
- Command output is visible to user if display masking permits it.
- Output is not sent back to provider.
- Chat label states output was hidden from assistant.

Automation:
- Existing: `tests/ui/llmPanel.test.tsx`.
- Missing: Electron smoke with settings toggle.

## TC-PRIVACY-006: Custom regex masks first capture group

- Priority: P1
- Type: unit, UI
- Sources: `SecretMaskingCustomPattern`, tests
- Coverage: partial
- Screenshot: none

Steps:
1. Add enabled custom regex `TOKEN=(\\w+)`.
2. Scan text `TOKEN=abc123`.

Expected:
- Only `abc123` is masked when capture group exists.
- Pattern name appears in active categories/audit context.
- Disabling the pattern stops custom masking.

Automation:
- Existing: `tests/unit/secretMasking.test.ts`.
- Missing: UI add/enable/disable test.

## TC-PRIVACY-007: Unsafe custom regex is rejected

- Priority: P1
- Type: unit, UI
- Sources: custom pattern validation, tests
- Coverage: partial
- Screenshot: none

Steps:
1. Try to add an invalid regex.
2. Try to add an overly broad or unsafe regex.

Expected:
- Invalid pattern shows validation error.
- Unsafe pattern is not persisted as enabled.
- Existing patterns remain unchanged.

Automation:
- Existing: `tests/unit/secretMasking.test.ts`.
- Missing: UI validation test.

## TC-PRIVACY-008: Masking audit log records source and scope

- Priority: P1
- Type: unit, UI, Electron smoke
- Sources: issue #36, PR #49, `SecretMaskingAuditEvent`
- Coverage: partial
- Screenshot: TODO under `../assets/security-privacy/masking-audit-log.png`

Steps:
1. Trigger provider payload masking.
2. Trigger chat display masking.
3. Open Security settings audit log.

Expected:
- Audit events include source, scope, count, categories, and timestamp.
- Clear log removes events.
- Empty state is shown after clear.

Automation:
- Existing: secret masking audit unit coverage.
- Missing: Electron smoke for audit UI.

## TC-PRIVACY-009: Inspectable masking notice opens relevant details

- Priority: P1
- Type: UI
- Sources: issue #36, PR #49
- Coverage: missing/partial
- Screenshot: TODO under `../assets/security-privacy/masking-notice.png`

Steps:
1. Trigger a masking notice in chat.
2. Click or expand the notice.

Expected:
- User can inspect what kind of masking happened.
- Details do not reveal raw secrets.
- Notice remains understandable after chat reload.

Automation:
- Existing: partial rendering coverage.
- Missing: UI interaction test.

## TC-PRIVACY-010: Trust center never shows protected state with no active scopes

- Priority: P0
- Type: unit, UI
- Sources: issue #27, PR #38, project AGENTS note
- Coverage: partial
- Screenshot: TODO under `../assets/security-privacy/trust-center-no-scopes.png`

Steps:
1. Enable secret masking.
2. Disable provider payload, chat display, and strict terminal context scopes.
3. Open Security settings.

Expected:
- UI says no active protection.
- It does not show green/protected wording.
- Re-enabling masking can restore safe defaults or require explicit scopes.

Automation:
- Existing: `tests/unit/secretMaskingUi.test.ts`.
- Missing: Electron screenshot smoke for trust center state.

