# Taviraq

<p align="center">
  <img src="docs/media/taviraq-icon.png" alt="Taviraq app icon" width="96" height="96">
</p>

<p align="center">
  <strong>AI-native terminal for local and SSH workflows.</strong>
  <br>
  Your terminal, with AI context and command safety.
</p>

<p align="center">
  <img alt="macOS" src="https://img.shields.io/badge/macOS-13%2B-black?logo=apple&logoColor=white">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="License" src="https://img.shields.io/github/license/doka-nt/taviraq">
  <img alt="Stars" src="https://img.shields.io/github/stars/doka-nt/taviraq?style=social">
</p>

<p align="center">
  <a href="https://taviraq.dev">Website</a>
  ·
  <a href="https://github.com/Doka-NT/Taviraq/releases">Download</a>
  ·
  <a href="docs/security-privacy.md">Security & Privacy</a>
  ·
  <a href="https://github.com/Doka-NT/Taviraq/issues">Issues</a>
</p>

<p align="center">
  <img src="docs/media/taviraq-demo.gif" alt="Taviraq agent mode demo" width="800">
</p>

## What it is

Taviraq is a macOS terminal with a built-in AI assistant that understands terminal output, helps with debugging and shell workflows, and safely executes commands through approval-based agent mode.

Use it as a normal terminal, then switch the assistant between read-only help and agent mode when you want it to propose and run commands step by step. The terminal stays in front: real local shells, SSH through your system `ssh`, searchable output, clickable links, tabs, themes, and a compact assistant sidebar.

## Core workflows

- **Explain failing output** — select text, use recent output, or share the current session so the assistant can explain errors and logs without leaving the terminal.
- **Get a safe next command** — ask for one next step, review what it does, and keep the final approval before risky or unclear commands run.
- **Troubleshoot SSH sessions** — diagnose remote shells with the same context flow, while agent mode still routes risky commands through an in-app safety gate.

## Highlights

- **Real terminal sessions** — local PTY tabs plus SSH profiles that use your existing config, keys, agents, and jump hosts.
- **Context-aware assistant** — ask about selected text, recent output, the current session, or what command should come next.
- **Agent mode with safety checks** — commands run one at a time, with a dedicated risk model and confirmation modal for dangerous steps.
- **Local secret masking** — detect and mask likely secrets before chat context, command checks, or summaries are sent to a provider.
- **Provider choice** — connect OpenAI-compatible APIs, Ollama, or LM Studio, with separate chat and command-risk models.
- **Prompt and command libraries** — save reusable prompts, turn chats into prompts, and keep command snippets close to the terminal.
- **Personal workspace** — restore sessions, reopen chat history, tune themes and font size, change language, and import or export settings.
- **macOS-native storage** — non-secret settings live in app data, while API keys stay in the system keychain.

## Security and privacy

- API keys are stored in the macOS Keychain through `keytar`, not in project config files.
- Non-secret provider settings, prompts, and app configuration are stored locally in app data.
- You choose which provider receives assistant context: OpenAI-compatible APIs, Ollama, or LM Studio.
- The assistant only receives the context mode you select, such as selected text, recent output, or the current session.
- When secret masking is enabled, Taviraq scans assistant requests locally and replaces detected secrets before provider traffic leaves the app.
- Commands that reference a masked local secret always require confirmation before Taviraq resolves the value locally and writes to the terminal.
- Agent mode checks built-in protected-command patterns and then asks a dedicated command-risk model before auto-execution.
- If command-risk classification fails or cannot be parsed, the command is treated as risky and requires confirmation.
- Risky or unclear commands pause in an in-app confirmation modal before they touch your shell.

More detail:

- [Security and Privacy](docs/security-privacy.md)
- [Command Safety Eval](docs/safety-eval.md)
- [Comparison](docs/comparison.md)
- [Release Checklist](docs/release-checklist.md)
- [macOS Signing and Notarization](docs/signing-notarization.md)

## Getting started

### Download

Grab the latest `.zip` from [Releases](https://github.com/Doka-NT/taviraq/releases), unzip it, and drag **Taviraq.app** to your Applications folder.

Current release builds are unsigned. macOS will warn that the app is from an unidentified developer.

> **First launch:** right-click **Taviraq.app** → **Open** → **Open** to proceed.
> Or run: `xattr -dr com.apple.quarantine "/Applications/Taviraq.app"`

Release assets include a `checksums.txt` file when built by GitHub Actions.

### Build from source

```bash
git clone https://github.com/Doka-NT/taviraq.git
cd taviraq
make build
```

Open `dist/`, unzip the archive or run the package, and drag **Taviraq.app** to your Applications folder when needed.

On first launch, go to **Settings → Providers** and add your API key and base URL. Then pick a model and start a session.

---

## Development

**Run locally:**

```bash
npm install
npm run dev
```

**Prepare the bundled local scanner:**

```bash
npm run prepare:gitleaks
```

Package builds run this automatically. Development builds can still run without
the binary, but the bundled Gitleaks scanner is only available after preparation.

**Checks:**

```bash
npm run lint
npm run typecheck
npm test
```

**Build macOS package:**

```bash
make build
# Output: dist/*.pkg and dist/*.zip (unsigned)
```

## License

Taviraq source code is licensed under the
[GNU Affero General Public License v3.0 or later](LICENSE).

Copyright (C) 2026 Soshnikov Artem.

The Taviraq name, logo, icon, and other branding assets are not licensed
for use as trademarks or to imply endorsement. Forks and redistributed builds
should use their own name and branding unless they have written permission.
