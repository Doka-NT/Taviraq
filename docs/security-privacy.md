# Security and Privacy

Taviraq is a local-first macOS terminal with AI assistance. This page documents
what data is stored, what may be sent to model providers, and how command
execution is controlled.

## Storage

- API keys are stored in the macOS Keychain through `keytar`.
- Provider settings, prompts, command snippets, chat history, and session state
  are stored locally in Electron app data.
- Renderer preferences such as sidebar width and terminal text size are stored
  in `localStorage`.
- Taviraq does not persist API keys in `config.json`, exports, prompts, or
  command snippets.

## Model Providers

Taviraq supports Anthropic, OpenAI-compatible APIs, Ollama, and LM Studio. The
provider you configure receives the assistant request when you send a message
or when agent mode checks command risk.

Local providers such as Ollama and LM Studio can keep model traffic on your
machine, subject to how those tools are configured. Remote providers receive
the selected prompt, selected context, and command-risk requests.

## Assistant Context

The assistant receives only the context mode selected in the UI, for example:

- selected terminal text
- recent terminal output
- current session context
- no terminal context

Before sharing logs or command output with a remote provider, remove secrets
such as tokens, passwords, private hostnames, and customer data.

## Command Safety

Agent mode can run one fenced shell command at a time. Before Taviraq writes an
agent command to the terminal:

1. Built-in protected-command checks flag known risky command classes.
2. A dedicated command-risk model reviews commands that are not caught by the
   built-in checks.
3. Risky or unclear commands pause in an in-app confirmation modal.
4. If the model is unavailable, times out, or returns unreadable output, Taviraq
   fails closed and requires confirmation.

Protected command classes include recursive deletion, elevated privileges,
recursive permission changes, disk formatting, `curl | sh`, destructive
Kubernetes and Terraform operations, destructive SQL, destructive Git commands,
package installation/removal, process termination, and shutdown/reboot commands.

## SSH

SSH sessions use the system `ssh` binary, so existing SSH config, keys, agents,
and jump hosts continue to apply. The same command gate is used for local and
SSH sessions. Built-in safety reasons call out SSH context when a protected
command would run in a remote session.

## Telemetry

The app does not contain a product analytics or telemetry pipeline. Network
traffic is limited to the providers and endpoints you configure, release/update
checks performed by your installation method, and normal web links you choose
to open.

## Reporting Concerns

Use the Safety or security concern issue template for command-risk,
privacy-context, key storage, SSH, or agent execution problems. Remove secrets
from any public report.
