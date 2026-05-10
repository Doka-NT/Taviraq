---
name: Safety or security concern
about: Report a command safety, privacy, or security concern
title: "safety: "
labels: bug
assignees: ""
---

If this is a sensitive vulnerability, avoid posting exploit details publicly.
Open a minimal issue here and contact the maintainer privately if a private
channel is available.

## Concern type

- [ ] Command risk classification
- [ ] Agent mode execution
- [ ] LLM context privacy
- [ ] API key or secret handling
- [ ] Local storage
- [ ] SSH workflow safety
- [ ] Other:

## Summary

Describe the concern and why it matters.

## Scenario

What was the user doing? Include whether this was a local or SSH session.

## Command or context involved

```sh
# Paste the command or a simplified example here.
# Remove API keys, tokens, hostnames, and other secrets.
```

## Expected safety behavior

What should Taviraq have done?

Examples: block execution, require confirmation, explain risk, use read-only
alternatives first, or avoid sending certain context to the provider.

## Actual behavior

What happened instead?

## Environment

- Taviraq version:
- macOS version:
- Session type: local / SSH
- Provider:
- Chat model:
- Command-risk model:
