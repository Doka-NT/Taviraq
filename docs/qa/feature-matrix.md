# Taviraq Feature Matrix

Baseline: `origin/main`

## Terminal Core

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Local PTY session creation, output, resize, exit | README, `TerminalManager`, preload API | Partial | `TC-TERMINAL-001`, `TC-TERMINAL-002`, `TC-TERMINAL-003` |
| Terminal tabs: create, close, switch, numeric shortcuts | README, `App.tsx`, shortcut types | Missing/partial | `TC-TERMINAL-004`, `TC-TERMINAL-005` |
| xterm rendering: WebGL, cursor visibility, alternate buffer | PR #10, commits `3e6486c`, `84b666e` | Partial | `TC-TERMINAL-006`, `TC-TERMINAL-007` |
| Search panel and clickable links | PR #2, commits `2ae5b76`, `dab22e2` | Missing | `TC-TERMINAL-008`, `TC-TERMINAL-009` |
| Terminal command block detection, selection, rerun, ask assistant | PR #20, commits `f86b92d`, `9fd876c` | Partial | `TC-TERMINAL-010`, `TC-TERMINAL-011`, `TC-TERMINAL-012` |

## SSH

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Saved SSH profiles with host/user/port/identity/extra args | README, settings UI, preload API | Partial | `TC-SSH-001`, `TC-SSH-002`, `TC-SSH-003` |
| New tab dropdown for local and SSH sessions | README, issue #30, PR #41 | Missing | `TC-SSH-004` |
| SSH command detection, context labels, reconnect state | `ssh.ts`, issue #30, PR #41 | Partial | `TC-SSH-005`, `TC-SSH-006` |
| Safety context for remote commands | docs/safety-eval.md, issue #30 | Partial | `TC-SSH-007` |

## Assistant

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Read mode and agent mode | README, `LlmPanel.tsx` | Partial | `TC-ASSIST-001`, `TC-ASSIST-002` |
| Selected text, recent output, current session, no-context behavior | README, docs/security-privacy.md, issue #32 | Partial | `TC-ASSIST-003`, `TC-ASSIST-004` |
| Streaming chunks, reasoning, progress, cancellation | commits `c85d744`, `ee49c1e`, native providers | Partial | `TC-ASSIST-005`, `TC-ASSIST-006` |
| Regenerate/fork chat messages and prefill regression | PR #21, issue #18, commit `b1cf874` | Partial | `TC-ASSIST-007`, `TC-ASSIST-008` |
| Composer context/mode/token indicators | issue #32, PR #44 | Missing/partial | `TC-ASSIST-009` |
| First-run activation and empty states | issue #26, PR #37 | Missing | `TC-ASSIST-010` |

## Command Safety

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Built-in protected command checks | docs/safety-eval.md, commit `b8b51c2` | Partial | `TC-SAFETY-001`, `TC-SAFETY-002` |
| Model-based command risk assessment | README, `llmService`, safety docs | Partial | `TC-SAFETY-003`, `TC-SAFETY-004` |
| In-app confirmation modal with edit/approve/reject | PR #39, issue #28, commits `2f0c763`, `6931d9b` | Partial | `TC-SAFETY-005`, `TC-SAFETY-006`, `TC-SAFETY-007` |
| Agent command newline/running-state regressions | issue #8, PR #11, commit `11a2d27` | Partial | `TC-SAFETY-008`, `TC-SAFETY-009` |
| Auditable risky command statuses | issue #28, PR #39 | Missing/partial | `TC-SAFETY-010` |

## Security And Privacy

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Secret masking before provider payloads | issue #14, PR #16 | Partial | `TC-PRIVACY-001`, `TC-PRIVACY-002` |
| Chat display, command output, and saved history redaction | PR #49, docs/security-privacy.md | Partial | `TC-PRIVACY-003`, `TC-PRIVACY-004` |
| Strict terminal context | AGENTS notes, tests | Partial | `TC-PRIVACY-005` |
| Custom regex masking patterns | `SecretMaskingSettings`, tests | Partial | `TC-PRIVACY-006`, `TC-PRIVACY-007` |
| Audit log and inspectable notices | issue #36, PR #49 | Partial | `TC-PRIVACY-008`, `TC-PRIVACY-009` |
| Trust center settings | issue #27, PR #38 | Missing/partial | `TC-PRIVACY-010` |

## Providers

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| OpenAI-compatible provider configuration | README, provider utils | Partial | `TC-PROVIDER-001`, `TC-PROVIDER-002` |
| Native Ollama and LM Studio support | commits `dd79955`, `ab5ff7e` | Partial | `TC-PROVIDER-003`, `TC-PROVIDER-004` |
| Native Anthropic support | issue #22, PR #23 | Partial | `TC-PROVIDER-005` |
| API key storage in keychain | README, docs/security-privacy.md | Partial/manual | `TC-PROVIDER-006` |
| HTTP(S) proxy and proxy password keychain storage | issue #24, PR #25 | Partial | `TC-PROVIDER-007`, `TC-PROVIDER-008` |
| Connection testing and setup feedback | issue #29, PR #40 | Missing/partial | `TC-PROVIDER-009` |

## Prompts And Snippets

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Prompt library CRUD, search, import Markdown | commits `895f0cb`, `ec5e1a5` | Partial | `TC-PROMPT-001`, `TC-PROMPT-002`, `TC-PROMPT-003` |
| Conversation summary to prompt | commits `b5cc73c`, `ad5a1d9`, `08ed875` | Partial | `TC-PROMPT-004`, `TC-PROMPT-005` |
| Command snippets CRUD, duplicate validation, quick palette | commit `e4d0968`, UI strings | Partial | `TC-SNIPPET-001`, `TC-SNIPPET-002`, `TC-SNIPPET-003` |
| Insert vs run snippet behavior | UI strings, `App.tsx` | Missing | `TC-SNIPPET-004`, `TC-SNIPPET-005` |

## Settings And Appearance

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Settings tabs and search | issue #35, PR #46, commit `25fff65` | Missing/partial | `TC-SETTINGS-001`, `TC-SETTINGS-002` |
| Terminal font size, output context size, validation | issue #31, PR #48, commits `1f12c36`, `4bcbce7` | Partial | `TC-SETTINGS-003`, `TC-SETTINGS-004` |
| Theme and language preferences | issue #31, PR #48 | Missing/partial | `TC-SETTINGS-005`, `TC-SETTINGS-006` |
| Sidebar resize/open handle | README, commit `58ec0f6` | Missing | `TC-SETTINGS-007` |
| Global hide/show shortcut recording and conflicts | `main/index.ts`, UI strings | Missing | `TC-SETTINGS-008` |
| About version, homepage, icon, dismissal | issue #42, PR #45, issue #50, PR #51 | Missing | `TC-SETTINGS-009`, `TC-SETTINGS-010` |

## Command Palette And Shortcuts

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Unified command palette for product actions | issue #34, PR #43 | Missing | `TC-PALETTE-001`, `TC-PALETTE-002`, `TC-PALETTE-003` |
| Product shortcuts routed through app actions | `AppShortcutAction`, `main/index.ts`, PR #43 | Missing/partial | `TC-PALETTE-004`, `TC-PALETTE-005` |

## Data, Chat History, And Sessions

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Session state save/restore/clear | `SessionStateSnapshot`, tests | Partial | `TC-SESSION-001`, `TC-SESSION-002`, `TC-SESSION-003` |
| Chat history list/get/save/delete/clear | preload API, settings data tab | Missing/partial | `TC-CHAT-001`, `TC-CHAT-002`, `TC-CHAT-003` |
| Export/import providers, prompts, snippets, SSH profiles, preferences | `ExportData`, settings data tab | Missing/partial | `TC-DATA-001`, `TC-DATA-002`, `TC-DATA-003` |
| Danger zone destructive settings actions | commit `b1d0287` | Missing | `TC-DATA-004` |

## Rendering And UX

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| Markdown headings, tables, numeric mini-bars | commits `2dc4e13`, redesign tests | Partial | `TC-RENDER-001`, `TC-RENDER-002` |
| Shell command action pills and redaction | `MessageContent`, tests | Partial | `TC-RENDER-003` |
| Assistant message and code block copy actions | issue #62, `MessageContent`, `LlmPanel` | Partial | `TC-RENDER-008` |
| Empty states and CTAs | issues #26, #35, commits `1c8a133`, `e857cdc` | Missing/partial | `TC-RENDER-004`, `TC-RENDER-005` |
| Accessibility labels and keyboard navigation | commits `5b35024`, `ec573e1` | Missing/partial | `TC-RENDER-006`, `TC-RENDER-007` |

## Packaging And Release

| Feature | Sources | Coverage | Test Cases |
| --- | --- | --- | --- |
| CI verify: lint, typecheck, tests, build | `.github/workflows/ci.yml` | Existing in CI | `TC-RELEASE-001` |
| macOS unsigned package/zip build | README, release workflow | Manual/CI | `TC-RELEASE-002`, `TC-RELEASE-003` |
| Daily release tag and release notes/checksums | PR #4, PR #13, release workflow | CI/manual | `TC-RELEASE-004`, `TC-RELEASE-005` |
| Demo recording scripts | commit `f19c1cb` | Missing/manual | `TC-RELEASE-006` |
