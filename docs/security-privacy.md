# Security and Privacy

Taviraq is a local-first macOS terminal with AI assistance. This page documents
what data is stored, what may be sent to model providers, and how command
execution is controlled.

## Storage

- API keys are stored in the macOS Keychain.
- Provider settings, prompts, command snippets, chat history, and session state
  are stored locally in Electron app data.
- UI preferences such as sidebar width and terminal text size are stored in
  `localStorage`.
- API keys are never written to config files, prompt definitions,
  or snippet definitions.

## Model Providers

Taviraq supports Anthropic, OpenAI-compatible APIs, Ollama, and LM Studio. The
provider you configure receives the assistant request when you send a message
or when agent mode checks command risk.

Local providers such as Ollama and LM Studio keep traffic on your machine as
long as they are configured to run locally. Remote providers receive the
selected prompt, selected context, and command-risk requests.

## Assistant Context

The assistant receives only the context mode selected in the UI, for example:

- selected terminal text
- recent terminal output
- current session context
- no terminal context

When secret masking is enabled in Settings, Taviraq scans assistant requests
before they are sent to the provider. This covers chat messages, selected text,
terminal output, command-risk checks, and conversation summaries. Detected
secrets are replaced with opaque placeholders for the model and shown as
`[secret]` in the UI.

The scanner combines Gitleaks rules with Taviraq contextual checks for
secret-looking values such as tokens, passwords, authorization headers, and
credential URLs. If the scanner fails or times out, the content is blocked
from being sent.

Secret masking reduces accidental disclosure but cannot guarantee that every
sensitive value will be caught. Private hostnames, customer data, and
domain-specific identifiers may not match known secret patterns.

## Command Safety

Agent mode can run one fenced shell command at a time. Before a command is
written to the terminal:

1. Built-in checks flag known risky command classes.
2. A dedicated command-risk model reviews commands not flagged by the built-in
   checks.
3. Risky or unclear commands require confirmation in an in-app modal.
4. If the model is unavailable, times out, or returns unreadable output, the
   command requires confirmation.

Commands that reference a masked secret always require confirmation. The actual
secret value is resolved only after approval, immediately before the command is
written to the terminal.

Protected command classes include recursive deletion, elevated privileges,
recursive permission changes, disk formatting, `curl | sh`, destructive
Kubernetes and Terraform operations, destructive SQL, destructive Git commands,
package installation/removal, process termination, and shutdown/reboot commands.

## SSH

SSH sessions use the system `ssh` binary, so existing SSH config, keys, agents,
and jump hosts continue to work. The same command safety checks apply to both
local and SSH sessions. When a protected command targets a remote session, the
confirmation message notes the SSH context.

## Telemetry

The app does not include analytics or telemetry. Network traffic goes only to
the providers you configure, update checks from your installation method, and
any links you open manually.

## Reporting Concerns

Use the Safety or security concern issue template for command-risk,
privacy-context, key storage, SSH, or agent execution problems. Remove secrets
from any public report.
