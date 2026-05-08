# AI Terminal

<p align="center">
  <img src="docs/media/ai-terminal-icon.png" alt="AI Terminal app icon" width="96" height="96">
</p>

<p align="center">
  <strong>A macOS terminal with an AI assistant built in.</strong>
  <br>
  Work in a real local or SSH terminal, ask about what is on screen, and let the AI run careful next steps when you want it to.
</p>

<p align="center">
  <img alt="macOS" src="https://img.shields.io/badge/macOS-13%2B-black?logo=apple&logoColor=white">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="License" src="https://img.shields.io/github/license/doka-nt/ai-terminal">
  <img alt="Stars" src="https://img.shields.io/github/stars/doka-nt/ai-terminal?style=social">
</p>

<p align="center">
  <img src="docs/media/ai-terminal-demo.gif" alt="AI Terminal agent mode demo" width="800">
</p>

## What it is

AI Terminal is a desktop terminal for macOS with an assistant panel built into the workflow. It keeps the terminal first: real local shells, SSH sessions through your system `ssh`, searchable output, clickable links, tabs, themes, and a compact sidebar that can explain or act on the context in front of you.

Use it as a normal terminal, then switch the assistant between read-only help and agent mode when you want it to propose and run commands step by step. Risky or unclear commands pause for an in-app approval before they touch your shell.

## Highlights

- **Real terminal sessions** — local PTY tabs plus SSH profiles that use your existing config, keys, agents, and jump hosts.
- **Context-aware assistant** — ask about selected text, recent output, the current session, or what command should come next.
- **Agent mode with safety checks** — commands run one at a time, with a dedicated risk model and confirmation modal for dangerous steps.
- **Provider choice** — connect OpenAI-compatible APIs, Ollama, or LM Studio, with separate chat and command-risk models.
- **Prompt and command libraries** — save reusable prompts, turn chats into prompts, and keep command snippets close to the terminal.
- **Personal workspace** — restore sessions, reopen chat history, tune themes and font size, change language, and import or export settings.
- **macOS-native storage** — non-secret settings live in app data, while API keys stay in the system keychain.

## Getting started

### Download (recommended)

Grab the latest `.zip` from [Releases](https://github.com/Doka-NT/ai-terminal/releases), unzip it, and drag **AI Terminal.app** to your Applications folder.

> **First launch:** macOS will warn that the app is from an unidentified developer. Right-click → **Open** → **Open** to proceed.
> Or run: `xattr -dr com.apple.quarantine "/Applications/AI Terminal.app"`

### Build from source

```bash
git clone https://github.com/Doka-NT/ai-terminal.git
cd ai-terminal
make build
```

Open `dist/`, unzip the archive, and drag **AI Terminal.app** to your Applications folder.

On first launch, go to **Settings → Providers** and add your API key and base URL. Then pick a model and start a session.

---

## Development

**Run locally:**

```bash
npm install
npm run dev
```

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
