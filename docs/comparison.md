# Comparison

Taviraq is not trying to be the broadest agentic IDE. It is a real macOS
terminal with an AI assistant and a safety layer for local and SSH shell work.

## Positioning

Taviraq is for people who cannot afford surprise commands. It explains terminal
output, suggests next steps, and can act step by step, but risky commands pause
before they touch the shell.

## Taviraq vs Warp

Warp is a polished agentic development environment with a much wider platform
surface. Taviraq is narrower: local and SSH terminal workflows, explicit
context, bring-your-own providers, and command safety as the core product
surface.

Choose Taviraq when you want a smaller terminal-first tool where shell control
and approvals matter more than a full agentic workspace.

## Taviraq vs Wave Terminal

Wave Terminal is a broad open-source workspace terminal with AI, previews, file
editing, browser workflows, and remote machine features. Taviraq focuses on the
shell path: local PTY, system SSH, assistant context, and protected command
execution.

Choose Taviraq when the workflow is command-line troubleshooting and safe
execution rather than a full remote workspace.

## Taviraq vs iTerm2 AI

iTerm2 is the macOS incumbent terminal with powerful AI features. Taviraq starts
from the AI safety workflow: explicit context modes, a separate command-risk
model, built-in protected-command checks, and fail-closed command approval.

Choose Taviraq when you want AI command review to be a first-class part of the
terminal workflow.

## Taviraq vs Claude Code, Codex CLI, Gemini CLI, Aider, and OpenCode

These tools are coding agents. Taviraq is the terminal surface around shell
workflows. The long-term direction is to supervise agents running inside real
terminal tabs: show live output, preserve user control, and gate risky commands.

Choose Taviraq when the terminal session, SSH context, approvals, and audit trail
matter as much as the coding model.

## Current Tradeoffs

- Taviraq is macOS-first and early-stage.
- Current public builds may be unsigned until signing and notarization are
  configured for a release.
- Safety checks reduce surprise execution, but they are not a sandbox. Users
  should still review commands and provider context.
