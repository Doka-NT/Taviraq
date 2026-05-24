# Provider Test Cases

## TC-PROVIDER-001: Save OpenAI-compatible provider

- Priority: P0
- Type: unit, UI, manual
- Sources: README, provider settings, `LLMProviderConfig`
- Coverage: partial
- Screenshot: none

Steps:
1. Add provider type OpenAI-compatible.
2. Enter name, base URL, API key, and model.
3. Save and reopen Settings.

Expected:
- Non-secret config is persisted.
- API key is stored in keychain.
- Provider appears as selectable/active according to UI rules.

Automation:
- Existing: provider utility tests.
- Missing: UI and keychain manual validation.

## TC-PROVIDER-002: Normalize OpenAI-compatible base URL

- Priority: P1
- Type: unit
- Sources: provider utilities, tests
- Coverage: existing
- Screenshot: none

Steps:
1. Normalize compatible base URLs with and without trailing `/v1`.
2. Fetch model list from mocked response.

Expected:
- URL is normalized consistently.
- Models parse and sort correctly.
- Malformed model lists are rejected.

Automation:
- Existing: `tests/unit/provider.test.ts`.
- Missing: none for parser.

## TC-PROVIDER-003: Ollama native provider lists models

- Priority: P1
- Type: unit, manual
- Sources: commit `dd79955`, provider utilities
- Coverage: partial
- Screenshot: none

Steps:
1. Configure Ollama provider.
2. Fetch models from a mocked or local Ollama endpoint.

Expected:
- Taviraq uses native Ollama model endpoint shape.
- Model IDs are parsed.
- Connection errors are shown clearly.

Automation:
- Existing: `tests/unit/provider.test.ts`.
- Missing: manual/local-provider smoke.

## TC-PROVIDER-004: LM Studio native streaming progress is shown

- Priority: P1
- Type: unit, UI, manual
- Sources: commit `ab5ff7e`, `ChatStreamEvent.progress`
- Coverage: partial
- Screenshot: none

Steps:
1. Configure LM Studio provider.
2. Start chat request that emits model loading or prompt processing progress.

Expected:
- Progress event is parsed.
- UI shows non-blocking progress state.
- Final response replaces loading/progress state correctly.

Automation:
- Existing: protocol/provider parsing coverage.
- Missing: UI progress rendering test.

## TC-PROVIDER-005: Anthropic provider uses native API shape

- Priority: P0
- Type: unit, manual
- Sources: issue #22, PR #23
- Coverage: existing/partial
- Screenshot: none

Steps:
1. Configure Anthropic provider.
2. Fetch models.
3. Send mocked streaming chat.
4. Assess command risk.

Expected:
- Native Anthropic headers and endpoints are used.
- Text deltas stream correctly.
- Command risk assessment works with Anthropic messages.

Automation:
- Existing: `tests/unit/llmService.test.ts`, `tests/unit/provider.test.ts`, `tests/unit/llmProtocol.test.ts`.
- Missing: manual live-provider smoke.

## TC-PROVIDER-006: API keys are never stored in config

- Priority: P0
- Type: manual, integration
- Sources: README, docs/security-privacy.md, SecretStore
- Coverage: partial/manual
- Screenshot: none

Steps:
1. Save provider API key.
2. Inspect app config file.
3. Verify keychain has the secret.

Expected:
- Config contains only key reference.
- Raw key is absent from config, prompts, sessions, and logs.
- Key lookup succeeds through SecretStore.

Automation:
- Existing: service-level behavior indirectly covered.
- Missing: macOS keychain manual QA.

## TC-PROVIDER-007: HTTP(S) proxy settings are applied

- Priority: P1
- Type: unit, integration
- Sources: issue #24, PR #25
- Coverage: partial
- Screenshot: none

Steps:
1. Configure provider with HTTP or HTTPS proxy URL.
2. Send model list or chat request.

Expected:
- Request uses proxy dispatcher.
- Proxy origin is normalized.
- SOCKS proxy URL is rejected unless explicitly supported in the future.

Automation:
- Existing: `tests/unit/proxy.test.ts`, `tests/unit/llmService.test.ts`.
- Missing: UI test for proxy settings form.

## TC-PROVIDER-008: Proxy credentials use keychain

- Priority: P0
- Type: unit, manual
- Sources: issue #24, PR #25, `proxyPasswordRef`
- Coverage: partial
- Screenshot: none

Steps:
1. Add proxy username and password.
2. Save provider.
3. Reopen Settings and inspect config.

Expected:
- Proxy password is stored in keychain.
- Config stores only password reference.
- Clearing proxy password removes the saved secret reference.

Automation:
- Existing: `tests/unit/llmService.test.ts`.
- Missing: macOS keychain manual validation.

## TC-PROVIDER-009: Provider connection feedback reflects setup status

- Priority: P1
- Type: UI, Electron smoke
- Sources: issue #29, PR #40
- Coverage: missing/partial
- Screenshot: TODO for success and failure states

Steps:
1. Add provider with invalid base URL.
2. Fetch models.
3. Fix URL and fetch models again.

Expected:
- Invalid setup shows actionable failure feedback.
- Successful fetch updates model selectors/status.
- Stale success does not remain after provider settings change.

Automation:
- Existing: service/provider tests.
- Missing: UI test for feedback lifecycle.

## TC-PROVIDER-010: New provider draft appears in provider list

- Priority: P1
- Type: UI, manual
- Sources: issue #64
- Coverage: missing/partial
- Screenshot: TODO for provider draft row

Steps:
1. Open Settings > Providers with at least one saved provider.
2. Click Add provider.
3. Inspect the provider list before saving.
4. Switch back to an existing provider without saving.

Expected:
- A new provider row appears immediately after clicking Add provider.
- The draft row is visually distinct from saved providers.
- The form edits the draft provider, not the previously selected provider.
- Switching away without saving removes the unsaved draft row.

Automation:
- Existing: none.
- Missing: UI regression test for provider draft list rendering.

## TC-PROVIDER-011: Configure and import MCP servers

- Priority: P1
- Type: unit, UI, manual
- Sources: issue #72, `mcp.json`, `McpConfigStore`
- Coverage: partial
- Screenshot: TODO for MCP settings import list

Steps:
1. Open Settings > MCP.
2. Add a manual MCP server with name, command, arguments, and optional env values.
3. Save and inspect the app `mcp.json`.
4. Run MCP discovery with sample Claude, Copilot, Codex, or OpenCode config files present.
5. Select one discovered server and import it.
6. Fetch provider models that include MCP-capable model IDs.

Expected:
- Manual MCP servers are persisted to `mcp.json`.
- Discovery asks for permission before reading external tool configs.
- Found servers show their source and require explicit selection before import.
- Duplicate imported servers are skipped.
- MCP-capable models show a hammer indicator in model lists.

Automation:
- Existing: `tests/unit/mcpConfigStore.test.ts`, `tests/unit/provider.test.ts`.
- Missing: Electron/UI smoke for Settings > MCP discovery/import and model-list hammer rendering.
